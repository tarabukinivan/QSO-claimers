import crypto from 'crypto';

import axios from 'axios';

import { BINANCE } from '../../_inputs/settings';
import settings from '../../_inputs/settings/settings';
import { defaultTokenAbi } from '../../clients/abi';
import { UNABLE_GET_WITHDRAW_FEE_ERROR } from '../../constants';
import { BINANCE_API_URL, BINANCE_PUBLIC_API_URL } from '../../constants/urls';
import {
  addNumberPercentage,
  CryptoCompareResult,
  getAxiosConfig,
  getClientByNetwork,
  getExpectedBalance,
  getProxyAgent,
  getRandomNumber,
  getTokenContract,
  getTopUpOptions,
  GetTopUpOptionsResult,
  sleep,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../helpers';
import { type LoggerData, LoggerType } from '../../logger';
import {
  BinanceNetworks,
  BinanceTokenData,
  NumberRange,
  ProxyAgent,
  Tokens,
  TransformedModuleParams,
  WalletData,
} from '../../types';
import { BINANCE_NETWORK_MAP } from './constants';

export const executeBinanceWithdraw = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const {
    wallet,
    binanceWithdrawNetwork,
    tokenToWithdraw,
    minAndMaxAmount,
    minTokenBalance,
    logger,
    expectedBalance,
    amount,
    minAmount,
    useUsd,
    randomBinanceWithdrawNetworks,
    nativePrices,
    withdrawAdditionalPercent,
  } = params;

  return makeBinanceWithdraw({
    wallet,
    binanceWithdrawNetwork,
    nativePrices,
    tokenToWithdraw,
    minAndMaxAmount,
    minTokenBalance,
    logger,
    expectedBalance,
    amount,
    minAmount,
    useUsd,
    randomBinanceWithdrawNetworks,
    withdrawAdditionalPercent,
  });
};

interface MakeBinanceWithdraw {
  binanceWithdrawNetwork: BinanceNetworks;
  wallet: WalletData;
  logger: LoggerType;
  minAndMaxAmount: NumberRange;
  tokenToWithdraw?: Tokens;
  nativePrices: CryptoCompareResult;
  useUsd?: boolean;
  randomBinanceWithdrawNetworks?: BinanceNetworks[];
  amount?: number;
  percentToAdd?: number;
  minTokenBalance?: number;
  fee?: number;
  minAmount?: number;
  expectedBalance?: NumberRange;
  withdrawSleep?: NumberRange;
  hideExtraLogs?: boolean;
  preparedTopUpOptions?: GetTopUpOptionsResult;
  withdrawAdditionalPercent?: number;
  withMinAmountError?: boolean;
}
export const makeBinanceWithdraw = async (props: MakeBinanceWithdraw): TransactionCallbackReturn => {
  const logTemplate: LoggerData = {
    action: 'execWithdraw',
    status: 'in progress',
  };

  const {
    binanceWithdrawNetwork: binanceWithdrawNetworkProp,
    wallet,
    expectedBalance,
    logger,
    minTokenBalance,
    minAndMaxAmount,
    tokenToWithdraw: tokenToWithdrawProp,
    minAmount,
    amount,
    withdrawSleep,
    nativePrices,
    hideExtraLogs = false,
    useUsd = false,
    preparedTopUpOptions,
    withdrawAdditionalPercent,
    withMinAmountError,
  } = props;

  const binanceWithdrawNetwork = binanceWithdrawNetworkProp;

  const { currentExpectedBalance, isTopUpByExpectedBalance } = getExpectedBalance(expectedBalance);

  let binanceProxyAgent;
  if (settings.useProxy) {
    binanceProxyAgent = await getProxyAgent(
      {
        proxy: BINANCE.proxy,
        proxy_type: 'HTTP',
      },
      logger
    );
  }
  const client = getClientByNetwork(binanceWithdrawNetwork, wallet.privKey, logger);

  const nativeToken = client.chainData.nativeCurrency.symbol as Tokens;
  const tokenToWithdraw = tokenToWithdrawProp || nativeToken;
  const isNativeTokenToWithdraw = tokenToWithdraw === nativeToken;

  let tokenContractInfo;
  if (!isNativeTokenToWithdraw) {
    const tokenContract = getTokenContract({
      tokenName: tokenToWithdraw,
      network: binanceWithdrawNetwork,
    });

    tokenContractInfo = isNativeTokenToWithdraw
      ? undefined
      : {
          name: tokenToWithdraw,
          address: tokenContract.address,
          abi: defaultTokenAbi,
        };
  }

  const walletAddress = wallet.walletAddress;

  const fee = await getFee(binanceWithdrawNetwork, tokenToWithdraw, binanceProxyAgent?.proxyAgent);
  if (!fee) {
    return {
      status: 'error',
      message: `${UNABLE_GET_WITHDRAW_FEE_ERROR}: network=${binanceWithdrawNetwork}, token=${tokenToWithdraw}`,
    };
  }

  const topUpOptions =
    preparedTopUpOptions ||
    (await getTopUpOptions({
      client,
      wallet,
      logger,
      nativePrices,
      currentExpectedBalance,
      isTopUpByExpectedBalance,
      minTokenBalance,
      minAndMaxAmount,
      isNativeTokenToWithdraw,
      tokenContractInfo,
      tokenToWithdraw,
      amount,
      fee,
      network: binanceWithdrawNetwork,
      useUsd,
      minAmount,
      withMinAmountError,
    }));

  const isDone = 'isDone' in topUpOptions;
  if (isDone) {
    return {
      status: 'passed',
      message: topUpOptions.successMessage,
    };
  }

  const { currentAmount, currentMinAmount, shouldTopUp, prevTokenBalance } = topUpOptions;

  if (currentAmount && currentAmount < (currentMinAmount || 0)) {
    return {
      status: 'warning',
      message: `Amount ${currentAmount.toFixed(6)} is lower than minAmount ${(currentMinAmount || 0).toFixed(
        6
      )}. Increase your minAndMaxAmount or expectedBalance`,
    };
  }

  if (shouldTopUp) {
    const amount = +(
      withdrawAdditionalPercent ? addNumberPercentage(currentAmount, withdrawAdditionalPercent) : currentAmount
    ).toFixed(8);

    const correctNetwork = NETWORK_MAP[binanceWithdrawNetwork] || binanceWithdrawNetwork;
    const currentDate = Date.now();
    const queryString = `timestamp=${currentDate}&coin=${tokenToWithdraw}&network=${correctNetwork}&address=${walletAddress}&amount=${amount}`;
    const signature = crypto.createHmac('sha256', BINANCE.secretKeys.secret).update(queryString).digest('hex');
    const queryParams = `?${queryString}&signature=${signature}`;

    const config = await getAxiosConfig({
      proxyAgent: binanceProxyAgent?.proxyAgent,
      headers: {
        'X-MBX-APIKEY': BINANCE.secretKeys.apiKey,
      },
    });

    logger.info(`Withdrawing ${amount.toFixed(6)} ${tokenToWithdraw} in ${binanceWithdrawNetwork}`, logTemplate);

    const { data } = await axios.post(
      `${BINANCE_API_URL}/capital/withdraw/apply${queryParams}`,
      {
        coin: tokenToWithdraw,
        network: correctNetwork,
        address: walletAddress,
        amount,
      },
      config
    );

    logger.success(
      `${amount.toFixed(6)} ${tokenToWithdraw} were send. We are waiting for the withdrawal from Binance, relax...`,
      {
        ...logTemplate,
        status: 'succeeded',
      }
    );

    let currentBalance = await client.getNativeOrContractBalance(isNativeTokenToWithdraw, tokenContractInfo);

    while (!(currentBalance.int > prevTokenBalance)) {
      const currentSleep = withdrawSleep ? getRandomNumber(withdrawSleep) : 20;
      await sleep(currentSleep);
      currentBalance = await client.getNativeOrContractBalance(isNativeTokenToWithdraw, tokenContractInfo);

      if (!hideExtraLogs) {
        logger.info('Tokens are still on the way to your wallet...', logTemplate);
      }
    }

    if (data.id) {
      return {
        status: 'success',
        message: `Your wallet was successfully topped up from Binance. Current balance is [${currentBalance.int.toFixed(
          6
        )} ${tokenToWithdraw}]`,
      };
    }
  }

  return {
    status: 'error',
  };
};

const getFee = async (withdrawNetwork: BinanceNetworks, withDrawToken: Tokens, proxyAgent?: ProxyAgent) => {
  const config = await getAxiosConfig({
    proxyAgent,
  });

  const { data: feesData } = await axios.get(`${BINANCE_PUBLIC_API_URL}/capital/getNetworkCoinAll`, config);
  const data: BinanceTokenData[] = feesData?.data;
  const currentTokenData = data?.find(({ coin }) => coin === withDrawToken);
  if (!currentTokenData) {
    return;
  }

  const currentNetwork = currentTokenData.networkList.find(
    ({ network }) => network === BINANCE_NETWORK_MAP[withdrawNetwork]
  );
  if (!currentNetwork) {
    return;
  }

  return +currentNetwork.withdrawFee;
};

const NETWORK_MAP: Partial<Record<BinanceNetworks, string>> = {
  zkSync: 'zkSyncEra',
  polygon: 'matic',
};

export const execBinanceWithdraw = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make Binance withdraw...',
    transactionCallback: executeBinanceWithdraw,
  });
