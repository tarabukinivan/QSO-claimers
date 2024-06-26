import {
  calculateAmount,
  decimalToInt,
  getClientByNetwork,
  getContractData,
  getExpectedBalance,
  getGasOptions,
  getRandomNetwork,
  getRandomNumber,
  getTrimmedLogsAmount,
  intToDecimal,
  sleep,
  TransactionCallbackParams,
  TransactionCallbackResponse,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../helpers';
import { Tokens, TransformedModuleParams } from '../../../types';
import { MIN_AMOUNT_TO_BRIDGE, ORBITER_BRIDGE_CONTRACT, TRADING_FEE } from './constants';
import { getOrbiterValue } from './helpers';
export const execOrbiterBridge = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make orbiter bridge...',
    transactionCallback: makeOrbiterBridge,
  });

export const makeOrbiterBridge = async ({
  client,
  logger,
  balanceToLeft,
  destinationNetwork,
  minAndMaxAmount,
  wallet,
  gasLimitRange,
  expectedBalance,
  minAmount,
  usePercentBalance,
  gweiRange,
  network,
  randomNetworks,
  minNativeBalance,
  minDestNativeBalance,
  useUsd,
  nativePrices,
}: TransactionCallbackParams): TransactionCallbackReturn => {
  const { int: balance } = await client.getNativeBalance();

  const destinationClient = getClientByNetwork(destinationNetwork, wallet.privKey, logger);
  const destinationNativeBalance = await destinationClient.getNativeBalance();

  if (minDestNativeBalance && destinationNativeBalance.int >= minDestNativeBalance) {
    return {
      status: 'passed',
      message: `Native balance of ${destinationNetwork} [${getTrimmedLogsAmount(
        destinationNativeBalance.int,
        destinationClient.chainData.nativeCurrency.symbol as Tokens
      )}] already more than or equal ${minDestNativeBalance}`,
    };
  }
  let currentNetwork = network;
  let currentClient = client;
  const nativeToken = currentClient.chainData.nativeCurrency.symbol as Tokens;

  const { tokenContractInfo, isNativeToken, token } = getContractData({
    nativeToken,
    network: currentNetwork,
    token: 'ETH',
  });
  let currentToken = token;

  const randomNetworksLength = randomNetworks?.length || 0;
  if (randomNetworksLength) {
    const res = await getRandomNetwork({
      wallet,
      randomNetworks,
      logger,
      useUsd,
      nativePrices,
      tokenContractInfo,
      minTokenBalance: minNativeBalance,
      client: currentClient,
      network: currentNetwork,
      token: currentToken,
      isNativeToken,
      isWithdrawal: false,
    });

    if ('status' in res) {
      return res as TransactionCallbackResponse;
    }
    currentClient = res.client;
    currentNetwork = res.network;
    currentToken = res.token;
  }

  const { walletClient, publicClient, explorerLink } = currentClient;

  const nativeBalance = await currentClient.getNativeBalance();

  const logNativeBalance = getTrimmedLogsAmount(nativeBalance.int, nativeToken);
  if (!randomNetworksLength && minNativeBalance && nativeBalance.int < minNativeBalance) {
    return {
      status: 'passed',
      message: `Native balance ${logNativeBalance} in ${network} is lower than minNativeBalance ${minNativeBalance}`,
    };
  }

  const { currentExpectedBalance, isTopUpByExpectedBalance } = getExpectedBalance(expectedBalance);

  let amountWei;
  if (balanceToLeft && balanceToLeft[0] && balanceToLeft[1]) {
    const balanceToLeftInt = getRandomNumber(balanceToLeft);

    const balanceToLeftWei = intToDecimal({
      amount: balanceToLeftInt,
      decimals: nativeBalance.decimals,
    });

    amountWei = nativeBalance.wei - balanceToLeftWei;

    if (nativeBalance.int - balanceToLeftInt <= 0) {
      return {
        status: 'warning',
        message: `Balance is ${logNativeBalance} ETH that is lower than balance to left ${balanceToLeftInt}`,
      };
    }
  } else if (isTopUpByExpectedBalance) {
    amountWei = intToDecimal({
      amount: currentExpectedBalance - destinationNativeBalance.int,
      decimals: destinationNativeBalance.decimals,
    });
  } else {
    amountWei = calculateAmount({
      balance: nativeBalance.wei,
      isBigInt: true,
      minAndMaxAmount,
      usePercentBalance,
      decimals: nativeBalance.decimals,
    });
  }

  const amountInt = decimalToInt({
    amount: amountWei,
    decimals: nativeBalance.decimals,
  });
  if (amountInt < minAmount) {
    return {
      status: 'error',
      message: `Amount must be more than ${minAmount} to make bridge`,
    };
  }

  const minAmountToMakeBridge = MIN_AMOUNT_TO_BRIDGE + TRADING_FEE;

  if (balance < minAmount || minAmount < minAmountToMakeBridge) {
    return {
      status: 'warning',
      message: 'Insufficient balance for bridge',
    };
  }

  const logAmount = getTrimmedLogsAmount(amountInt, currentToken);
  logger.info(`Making bridge of [${logAmount}] from [${currentNetwork}] to [${destinationNetwork}].`);

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network: currentNetwork,
    publicClient,
  });

  const value = getOrbiterValue(amountInt, destinationNetwork);

  const request = await walletClient.prepareTransactionRequest({
    account: walletClient.account,
    to: ORBITER_BRIDGE_CONTRACT,
    value,
    ...feeOptions,
  });

  const signature = await walletClient.signTransaction(request);
  const txHash = await walletClient.sendRawTransaction({ serializedTransaction: signature });

  const transaction = await publicClient.getTransactionReceipt({ hash: txHash });

  if (transaction.status === 'success') {
    await sleep(10);

    let currentDestinationBalance = await destinationClient.getNativeBalance();
    while (!(currentDestinationBalance.int > destinationNativeBalance.int)) {
      const sleepTime = currentNetwork === 'polygon' ? 60 * 4 : 60;
      await sleep(sleepTime, {}, logger, `Waiting ${sleepTime}s for delivering...`);

      currentDestinationBalance = await destinationClient.getNativeBalance();
    }

    return {
      status: 'success',
      txHash,
      explorerLink,
      tgMessage: `Bridged [${currentNetwork}] > [${destinationNetwork}] | Amount [${logAmount}]`,
    };
  }

  return {
    status: 'error',
  };
};
