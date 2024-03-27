import settings from '../../_inputs/settings/settings';
import { WITHDRAW_ERROR } from '../../constants';
import { ClientType, CryptoCompareResult } from '../../helpers';
import { LoggerData } from '../../logger';
import { LoggerProp } from '../../logger/utils';
import { makeBinanceWithdraw, makeOkxWithdraw } from '../../modules';
import {
  AutoGasNetworkSettings,
  BINANCE_NETWORKS,
  BinanceNetworks,
  OKX_NETWORKS,
  OkxNetworks,
  SupportedNetworks,
  Tokens,
  WalletData,
} from '../../types';
import { AutoGasNetworks } from './types';

interface AutoGasProps extends LoggerProp {
  client: ClientType;
  network: SupportedNetworks | BinanceNetworks;
  wallet: WalletData;
  nativePrices: CryptoCompareResult;
}

export const runAutoGas = async ({ wallet, logger, client, network, nativePrices }: AutoGasProps) => {
  const logTemplate: LoggerData = {
    action: 'runAutoGas',
    status: 'in progress',
  };

  const { autoGas } = settings;

  const currentAutoGasNetwork = AUTOGAS_SETTING_MAP[network];

  if (!currentAutoGasNetwork || !(currentAutoGasNetwork in autoGas)) {
    return;
  }

  const currentAutoGas = autoGas[currentAutoGasNetwork] as AutoGasNetworkSettings;
  const { useAutoGas, minBalance, withdrawToAmount, withdrawSleep, cex, expectedBalance } = currentAutoGas;

  // logger.info(`Running autogas in ${network} network`, logTemplate);

  const nativeToken = client.chainData.nativeCurrency.symbol;
  const { int: currentBalance } = await client.getNativeBalance();

  if (!useAutoGas) {
    return;
  }

  if (currentBalance >= minBalance) {
    return;
  }

  const baseWithdrawArgs = {
    wallet,
    withdrawSleep,
    nativePrices,
    tokenToWithdraw: nativeToken as Tokens,
    minAndMaxAmount: withdrawToAmount,
    minNativeBalance: minBalance,
    hideExtraLogs: true,
    logger,
    expectedBalance,
  };

  let isDone = false;
  let successMessage;
  let errorMessage;

  if (cex === 'okx' && OKX_NETWORKS.includes(network as any)) {
    const res = await makeOkxWithdraw({
      okxWithdrawNetwork: network as OkxNetworks,
      ...baseWithdrawArgs,
    });

    if (res.status === 'passed' || res.status === 'success') {
      isDone = true;
      successMessage = res.message;
    } else {
      errorMessage = res.message;
    }
  }

  if (cex === 'binance' && BINANCE_NETWORKS.includes(network as any)) {
    const res = await makeBinanceWithdraw({
      binanceWithdrawNetwork: network as BinanceNetworks,
      ...baseWithdrawArgs,
    });

    if (res.status === 'passed' || res.status === 'success') {
      isDone = true;
      successMessage = res.message;
    } else {
      errorMessage = res.message;
    }
  }

  if (!isDone) {
    if (errorMessage) {
      throw new Error(errorMessage);
    } else {
      throw new Error(WITHDRAW_ERROR);
    }
  }

  if (successMessage) {
    logger.success(successMessage, logTemplate);
  }
};

const AUTOGAS_SETTING_MAP: Partial<Record<SupportedNetworks, AutoGasNetworks>> = {
  bsc: 'BSC',
  opBNB: 'opBNB',
  eth: 'ERC20',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  avalanche: 'Avalanche',
  optimism: 'Optimism',
  zkSync: 'zkSync',
  base: 'Base',
  linea: 'Linea',
  fantom: 'Fantom',
  core: 'Core',
  celo: 'Celo',
  klay: 'Klayn',
  scroll: 'Scroll',
};
