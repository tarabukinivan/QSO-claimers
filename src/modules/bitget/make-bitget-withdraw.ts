import { defaultTokenAbi } from '../../clients/abi';
import {
  calculateAmount,
  getRandomNetwork,
  getTrimmedLogsAmount,
  TransactionCallbackParams,
  TransactionCallbackResponse,
  TransactionCallbackReturn,
  transactionWorker,
  getContractData,
  getClientByNetwork,
  sleep,
  getTokenContract,
} from '../../helpers';
import { Bitget } from '../../managers/bitget';
import { Tokens, TransformedModuleParams } from '../../types';
import { makeBitgetWaitBalance } from './make-bitget-wait-balance';

export const execMakeBitgetWithdraw = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make withdraw from Bitget...',
    transactionCallback: makeBitgetWithdraw,
  });

export const makeBitgetWithdraw = async (props: TransactionCallbackParams): TransactionCallbackReturn => {
  const {
    client,
    minTokenBalance,
    network,
    logger,
    minAmount,
    usePercentBalance,
    minAndMaxAmount,
    tokenToWithdraw: tokenToWithdrawProp,
    randomNetworks,
    waitTime,
    wallet,
    useUsd,
    nativePrices,
    minDestTokenBalance,
    minDestTokenNetwork,
    waitBalance,
    collectTokens,
  } = props;

  try {
    if (minDestTokenBalance) {
      const destClient = getClientByNetwork(minDestTokenNetwork, wallet.privKey, logger);
      const nativeToken = destClient.chainData.nativeCurrency.symbol as Tokens;
      const tokenToCheck = tokenToWithdrawProp || nativeToken;

      const {
        tokenContractInfo,
        isNativeToken: isNativeTokenToWithdraw,
        token,
      } = getContractData({
        nativeToken,
        network: minDestTokenNetwork,
        token: tokenToCheck,
      });

      const balance = await destClient.getNativeOrContractBalance(isNativeTokenToWithdraw, tokenContractInfo);
      if (balance.int >= minDestTokenBalance) {
        return {
          status: 'passed',
          message: `Balance [${getTrimmedLogsAmount(
            balance.int,
            token
          )}] in ${minDestTokenNetwork} is already equal or more then minDestTokenBalance [${minDestTokenBalance} ${token}]`,
        };
      }
    }

    let withdrawNetwork = network;
    let currentClient = client;
    const nativeToken = currentClient.chainData.nativeCurrency.symbol as Tokens;

    let tokenToWithdraw = tokenToWithdrawProp;
    const {
      tokenContractInfo,
      isNativeToken: isNativeTokenToWithdraw,
      token,
    } = getContractData({
      nativeToken,
      network: withdrawNetwork,
      token: tokenToWithdraw,
    });
    tokenToWithdraw = token;

    if (randomNetworks?.length) {
      const res = await getRandomNetwork({
        wallet,
        randomNetworks,
        logger,
        minTokenBalance,
        useUsd,
        nativePrices,
        tokenContractInfo,
        client: currentClient,
        network: withdrawNetwork,
        token: tokenToWithdraw,
        isNativeToken: isNativeTokenToWithdraw,
      });

      if ('status' in res) {
        return res as TransactionCallbackResponse;
      }

      currentClient = res.client;
      withdrawNetwork = res.network;
      tokenToWithdraw = res.token;
    }

    // TODO: add usd support
    if (!randomNetworks?.length) {
      const isNativeToken = token === client.chainData.nativeCurrency.symbol;
      const tokenContract = getTokenContract({
        tokenName: token,
        network,
      }).address;

      const tokenContractInfo = isNativeToken
        ? undefined
        : {
            name: token,
            address: tokenContract,
            abi: defaultTokenAbi,
          };

      const { int: balance } = await client.getNativeOrContractBalance(isNativeToken, tokenContractInfo);

      if (minTokenBalance && balance >= minTokenBalance) {
        return {
          status: 'passed',
          message: `Balance [${balance} ${token}] in [${network}] already more than [${minTokenBalance} ${token}]`,
        };
      }
    }

    if (waitBalance && collectTokens?.length) {
      const { message } = await makeBitgetWaitBalance(props);
      if (message) {
        logger.success(message);
      }
    }

    const bitget = new Bitget({
      network: withdrawNetwork,
      client: currentClient,
      logger,
    });

    const balance = await bitget.getTokenBalance(tokenToWithdraw);

    const amount = calculateAmount({
      balance,
      minAndMaxAmount,
      usePercentBalance,
    });

    const logCalculatedAmount = `${getTrimmedLogsAmount(amount, tokenToWithdraw)}`;
    if (minAmount && amount < minAmount) {
      return {
        status: 'warning',
        message: `Calculated amount [${logCalculatedAmount}] is lower than provided minAmount [${minAmount}]`,
      };
    }

    const res = await bitget.makeWithdraw({
      amount,
      waitSleep: [waitTime, waitTime],
      token: tokenToWithdraw,
    });

    if (res && 'passedMessage' in res) {
      return {
        status: 'passed',
        message: res.passedMessage,
      };
    }

    return {
      status: 'success',
      tgMessage: `${withdrawNetwork} | Withdrawn: ${logCalculatedAmount}`,
    };
  } catch (err) {
    if ((err as Error).message?.includes('temporarily frozen to withdraw')) {
      logger.warning('Balance is temporarily frozen to withdraw');
      await sleep(60, {}, logger);

      return makeBitgetWithdraw(props);
    }

    throw err;
  }
};
