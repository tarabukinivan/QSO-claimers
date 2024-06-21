import { DataSource } from 'typeorm';

import settings from '../../_inputs/settings/settings';
import { NOT_SAVE_FAILED_WALLET_ERRORS, SOMETHING_WENT_WRONG, SUCCESS_MESSAGES_TO_STOP_WALLET } from '../../constants';
import {
  createRandomProxyAgent,
  getProxyAgent,
  initLocalLogger,
  msgToTemplateTransform,
  showLogPreparedModules,
  sleepByRange,
} from '../../helpers';
import {
  clearAllSavedModulesByName,
  clearSavedWallet,
  markSavedModulesAsError,
} from '../../helpers/modules/save-modules';
import { LoggerData } from '../../logger';
import { getGlobalModule } from '../../modules';
import {
  FindModuleReturnFc,
  ModuleNames,
  ProxyAgent,
  ProxyObject,
  StopModuleOnError,
  SupportedNetworks,
  TransformedModuleConfig,
  TransformedModuleParams,
  WalletData,
} from '../../types';
import { sendMsgToTG } from '../telegram';
import { getTgMessageByStatus } from '../telegram/helpers';
import { IModuleManager, StartModule } from './types';

let walletIndex: number = 1;

export abstract class ModuleManager {
  private wallet: WalletData;
  private modules: TransformedModuleConfig[];
  private baseNetwork: SupportedNetworks;
  private projectName: string;

  private walletsTotalCount: number;
  private dbSource?: DataSource;

  constructor({ walletWithModules, walletsTotalCount, baseNetwork, projectName, dbSource }: IModuleManager) {
    this.wallet = walletWithModules.wallet;
    this.modules = walletWithModules.modules;
    this.walletsTotalCount = walletsTotalCount;
    this.projectName = projectName;
    this.baseNetwork = baseNetwork;
    this.dbSource = dbSource;
  }

  abstract findModule(_moduleName: ModuleNames): FindModuleReturnFc | undefined;

  async startModules({ logsFolderName, nativePrices }: StartModule) {
    const walletId = this.wallet.id;
    const logger = initLocalLogger(logsFolderName, walletId);
    logger.setLoggerMeta({ wallet: this.wallet, moduleName: 'Module Manager' });
    const logTemplate: LoggerData = {
      status: 'in progress',
      action: 'startModules',
    };

    const preparedModules = this.modules;
    showLogPreparedModules(preparedModules, logger);

    let proxyObject: ProxyObject | undefined;
    let proxyAgent: ProxyAgent | undefined;

    if (settings.useProxy) {
      const walletProxy = this.wallet.proxy;
      const updateProxyLink = this.wallet.updateProxyLink;
      const isWalletProxyExist = !!walletProxy;
      const walletProxyData = isWalletProxyExist ? await getProxyAgent(walletProxy, updateProxyLink, logger) : null;
      const proxyData = walletProxyData || (await createRandomProxyAgent(updateProxyLink, logger));

      if (!proxyData) {
        logger.error('You do not use proxy! Fill the _inputs/csv/proxies.csv file');
      } else {
        const { proxyAgent: proxyAgentData, ...proxyObjectData } = proxyData;
        proxyAgent = proxyAgentData;
        proxyObject = proxyObjectData;
      }
    }

    await sleepByRange(settings.delay.betweenWallets, logTemplate, logger);

    let errorMessage = '';

    const telegramPrefixMsg = `[${walletIndex}/${this.walletsTotalCount}] [${this.wallet.id}]: ${this.wallet.walletAddress} \n`;
    walletIndex++;

    const modulesResult: string[] = [];

    let shouldStopReversedModule = false;
    const modulesToStopOnErrors: StopModuleOnError[] = [];

    for (let moduleIndex = 0; moduleIndex < preparedModules.length; moduleIndex++) {
      const markAsErrorData = {
        wallet: this.wallet,
        projectName: this.projectName,
        moduleIndex,
      };

      const module = preparedModules[moduleIndex] as TransformedModuleConfig;

      const { moduleName } = module;
      logger.setLoggerMeta({ moduleName });

      if (modulesToStopOnErrors.length) {
        const foundModuleToStop = modulesToStopOnErrors.find(({ moduleToStop }) => moduleToStop === module.moduleName);

        if (foundModuleToStop) {
          logger.warning(
            `Stop producing current MODULE, because of error in ${foundModuleToStop.errorFrom} module and provided stopModulesOnError`,
            logTemplate
          );
          continue;
        }
      }
      if (module.reverse && module.isReverse && shouldStopReversedModule) {
        shouldStopReversedModule = false;
        logger.warning('Stop producing current REVERSED MODULE, because of error on previous one', logTemplate);
        continue;
      }

      let currentModuleRunner: FindModuleReturnFc | undefined = getGlobalModule(moduleName);

      if (!currentModuleRunner) {
        currentModuleRunner = this.findModule(moduleName);
      }

      if (!currentModuleRunner) {
        logger.error(`Module [${moduleName}] not found`, logTemplate);
        return;
      }

      const moduleParams: TransformedModuleParams = {
        ...module,
        dbSource: this.dbSource,
        nativePrices,
        projectName: this.projectName,
        baseNetwork: this.baseNetwork,
        proxyAgent,
        proxyObject,
        wallet: this.wallet,
        logger,
        moduleIndex,
      };

      const isModuleWithReverse = module.reverse && !module.isReverse;

      try {
        const { status, message, tgMessage, logTemplate: moduleLogTemplate } = await currentModuleRunner(moduleParams);
        const messageToTg = tgMessage || message;

        if (status === 'passed' && module.stopWalletOnPassed) {
          logger.success('Stop producing current PASSED WALLET, because stopWalletOnPassed is true', {
            ...logTemplate,
          });

          clearSavedWallet(this.wallet, this.projectName);

          break;
        }

        // TODO: check it more, we should clear all wallet if stopWalletOnError is true ?
        if (status === 'passed' && isModuleWithReverse) {
          shouldStopReversedModule = false;
        }

        if (status === 'success') {
          if (isModuleWithReverse) {
            shouldStopReversedModule = false;
          }

          modulesResult.push(getTgMessageByStatus('success', moduleName, tgMessage));
        }

        if (status === 'warning' || status === 'critical' || status === 'error') {
          const messageWithModuleTemplate = msgToTemplateTransform(message || SOMETHING_WENT_WRONG, {
            ...moduleLogTemplate,
            status: 'failed',
          });

          if (module.stopModulesOnError?.length) {
            modulesToStopOnErrors.push(
              ...module.stopModulesOnError.map((moduleToStop) => ({
                errorFrom: module.moduleName,
                moduleToStop,
              }))
            );
          }
          if (isModuleWithReverse) {
            shouldStopReversedModule = true;
          }

          if (status === 'error') {
            modulesResult.push(getTgMessageByStatus('error', moduleName, messageToTg));

            throw new Error(messageWithModuleTemplate);
          }

          if (status === 'warning') {
            const errorMsg = `${messageWithModuleTemplate}${
              module.stopWalletOnError
                ? ', stop producing current wallet, because stopWalletOnError is true for current module'
                : ''
            }`;

            modulesResult.push(getTgMessageByStatus('warning', moduleName, messageToTg));

            logger.error(errorMsg, {
              ...logTemplate,
              status: 'failed',
            });

            markSavedModulesAsError(markAsErrorData);

            if (module.stopWalletOnError) {
              // Stop all modules and stop wallet
              break;
            }
          }

          if (status === 'critical') {
            logger.error(`${messageWithModuleTemplate}, stop producing current WALLET`, {
              ...logTemplate,
              status: 'failed',
            });

            errorMessage = message || SOMETHING_WENT_WRONG;

            await sendMsgToTG({
              message: `${telegramPrefixMsg} ${getTgMessageByStatus('critical', moduleName, message)}`,
              type: 'criticalErrors',
            });
            modulesResult.push(getTgMessageByStatus('error', moduleName, messageToTg));

            markSavedModulesAsError(markAsErrorData);

            // Stop all modules and stop wallet
            break;
          }
        }
      } catch (e) {
        const error = e as Error;
        errorMessage = error.message;

        if (isModuleWithReverse) {
          shouldStopReversedModule = true;
        }

        if (module.stopWalletOnError) {
          const errorMsg = `${errorMessage}, stop producing current wallet${
            module.stopWalletOnError ? ', because stopWalletOnError is true for current module' : ''
          }`;

          await sendMsgToTG({
            message: `${telegramPrefixMsg} ${getTgMessageByStatus('critical', moduleName, errorMsg)}`,
            type: 'criticalErrors',
          });

          modulesResult.push(getTgMessageByStatus('warning', moduleName, errorMsg));

          logger.error(errorMsg, {
            ...logTemplate,
            status: 'failed',
          });

          markSavedModulesAsError(markAsErrorData);

          // Stop all modules and stop wallet
          break;
        }

        const isSuccessMessage = SUCCESS_MESSAGES_TO_STOP_WALLET.find((error) => errorMessage.includes(error));
        if (isSuccessMessage) {
          clearAllSavedModulesByName({
            moduleName,
            wallet: this.wallet,
            projectName: this.projectName,
          });

          // modulesResult.push(getTgMessageByStatus('success', moduleName));

          logger.success(`${errorMessage}, stop producing current WALLET`, {
            ...logTemplate,
            status: 'succeeded',
          });

          errorMessage = '';

          // Stop all modules and stop wallet
          break;
        }

        logger.error(`${errorMessage}, stop producing current ${moduleName} MODULE`, {
          ...logTemplate,
          status: 'failed',
        });

        markSavedModulesAsError(markAsErrorData);

        const shouldNotSaveFailedWallet = NOT_SAVE_FAILED_WALLET_ERRORS.find((error) => errorMessage.includes(error));
        if (!module.stopWalletOnError && shouldNotSaveFailedWallet) {
          errorMessage = '';
        }
      } finally {
        await sleepByRange(settings.delay.betweenModules, { ...logTemplate, status: 'in progress' }, logger);
      }
    }

    if (modulesResult.length) {
      await sendMsgToTG({
        message: `${telegramPrefixMsg}${modulesResult.join('\n')}`,
      });
    }

    logger.success(`There are no more modules for current wallet [${this.wallet.walletAddress}]. Next wallet...`, {
      ...logTemplate,
      status: 'succeeded',
    });

    return errorMessage
      ? {
          wallet: this.wallet,
          errorMessage,
        }
      : { wallet: this.wallet };
  }
}
