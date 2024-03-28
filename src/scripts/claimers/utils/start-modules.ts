import { StartModulesCallbackArgs } from '../../../helpers';
import { ModuleManager } from '../managers';

export const startModulesCallback = ({
  walletWithModules,
  logsFolderName,
  walletsTotalCount,
  currentWalletIndex,
  nativePrices,
  projectName,
  baseNetwork,
  dbSource,
}: StartModulesCallbackArgs) =>
  new ModuleManager({
    walletWithModules,
    walletsTotalCount,
    projectName,
    baseNetwork,
    dbSource,
  }).startModules({
    logsFolderName,
    currentWalletIndex,
    nativePrices,
  });
