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
}: StartModulesCallbackArgs) =>
  new ModuleManager({
    walletWithModules,
    walletsTotalCount,
    projectName,
    baseNetwork,
  }).startModules({
    logsFolderName,
    currentWalletIndex,
    nativePrices,
  });
