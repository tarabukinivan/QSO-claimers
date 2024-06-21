import { ModuleNames } from '../types';
import { execBalanceChecker, execCheckNativeBalance } from './balance-checker';
import { execBinanceWithdraw } from './binance-withdraw';
import { execOrbiterBridge, execMakeRouternitroBridge, execMakeMesonBridge, execMakeRelayBridge } from './bridges';
import { execOkxCollect } from './okx-collect';
import { execOkxWithdraw } from './okx-withdraw';
import { execMakeIzumiSwap, execMakeSyncSwap, execMake1inchSwap, execMakeOdosSwap } from './swaps';
import { execMakeTopUp } from './top-up-eth-mainnet';
import { execMakeTransferToken } from './transfer-token';

export const getGlobalModule = (moduleName: ModuleNames) => {
  switch (moduleName) {
    case 'binance-withdraw':
      return execBinanceWithdraw;
    case 'okx-withdraw':
      return execOkxWithdraw;

    case 'transfer-token':
      return execMakeTransferToken;
    case 'top-up-eth-mainnet':
      return execMakeTopUp;
    case 'okx-collect':
      return execOkxCollect;

    case 'balance-checker':
      return execBalanceChecker;
    case 'check-native-balance':
      return execCheckNativeBalance;

    case 'routernitro-bridge':
      return execMakeRouternitroBridge;
    case 'orbiter-bridge':
      return execOrbiterBridge;
    case 'relay-bridge':
      return execMakeRelayBridge;
    case 'meson-bridge':
      return execMakeMesonBridge;

    case 'izumi-swap':
      return execMakeIzumiSwap;
    case 'sync-swap':
      return execMakeSyncSwap;
    case '1inch-swap':
      return execMake1inchSwap;
    case 'odos-swap':
      return execMakeOdosSwap;

    default:
      return;
  }
};
