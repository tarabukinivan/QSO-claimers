import axios from 'axios';
import { formatEther } from 'ethers';
import { Hex } from 'viem';

import {
  calculateAmount,
  decimalToInt,
  getAxiosConfig,
  getClientByNetwork,
  getContractData,
  getExpectedBalance,
  getGasOptions,
  getHeaders,
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
import { getAmount, getDonationData, getEligibilityData } from '../../../scripts/claimers/modules/layer-zero/helpers';
import { Tokens, TransformedModuleParams } from '../../../types';
import { API_URL, HEADERS } from './constants';

export const execMakeRelayBridge = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make relay bridge...',
    transactionCallback: makeRelayBridge,
  });

export const makeRelayBridge = async ({
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
  proxyAgent,
  gweiRange,
  maxFee,
  network,
  randomNetworks,
  minNativeBalance,
  minDestNativeBalance,
  useUsd,
  nativePrices,
  addDonationAmount,
}: TransactionCallbackParams): TransactionCallbackReturn => {
  const destinationClient = getClientByNetwork(destinationNetwork, wallet.privKey, logger);
  const destinationNativeBalance = await destinationClient.getNativeBalance();

  if (minDestNativeBalance && destinationNativeBalance.int >= minDestNativeBalance) {
    return {
      status: 'passed',
      message: `Native balance of ${destinationNetwork} [${getTrimmedLogsAmount(
        destinationNativeBalance.int,
        destinationClient.chainData.nativeCurrency.symbol as Tokens
      )}] already more than or equal minDestNativeBalance ${minDestNativeBalance}`,
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

  let additionalAmount = 0;
  if (addDonationAmount) {
    const headers = getHeaders(HEADERS);
    const config = await getAxiosConfig({
      proxyAgent,
      headers,
    });

    const eligibilityRes = await getEligibilityData({
      network: 'arbitrum',
      walletAddress: wallet.walletAddress as Hex,
      chainId: 42_161,
      config,
    });

    if (eligibilityRes.isEligible) {
      const { amountInt } = await getAmount(eligibilityRes);

      const { donationAmountInt } = await getDonationData({
        client,
        network: 'arbitrum',
        amountInt,
        nativePrices,
      });

      additionalAmount = donationAmountInt;
    }
  }

  const randomNetworksLength = randomNetworks?.length || 0;
  if (randomNetworksLength) {
    const res = await getRandomNetwork({
      wallet,
      randomNetworks,
      logger,
      useUsd,
      nativePrices,
      tokenContractInfo,
      minTokenBalance: minNativeBalance ? minNativeBalance + additionalAmount : minNativeBalance,
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

  const { walletClient, publicClient, walletAddress, chainData, explorerLink } = currentClient;

  const dstChainId = destinationClient.chainData.id;

  const nativeBalance = await currentClient.getNativeBalance();

  const logNativeBalance = getTrimmedLogsAmount(nativeBalance.int, nativeToken);
  if (!randomNetworksLength && minNativeBalance && nativeBalance.int < minNativeBalance) {
    return {
      status: 'passed',
      message: `Native balance ${logNativeBalance} in ${network} is lower than minNativeBalance ${minNativeBalance}`,
    };
  }

  const { currentExpectedBalance, isTopUpByExpectedBalance } = getExpectedBalance(
    expectedBalance && expectedBalance[0] && expectedBalance[1]
      ? [expectedBalance[0] + additionalAmount, expectedBalance[1] + additionalAmount]
      : expectedBalance
  );

  let amountWei;
  if (balanceToLeft && balanceToLeft[0] && balanceToLeft[1]) {
    const balanceToLeftInt = getRandomNumber([
      balanceToLeft[0] + additionalAmount,
      balanceToLeft[1] + additionalAmount,
    ]);

    const balanceToLeftWei = intToDecimal({
      amount: balanceToLeftInt,
      decimals: nativeBalance.decimals,
    });

    amountWei = nativeBalance.wei - balanceToLeftWei;

    if (nativeBalance.int - balanceToLeftInt <= 0) {
      return {
        status: 'warning',
        message: `Balance is ${logNativeBalance} that is lower than balance to left ${balanceToLeftInt}`,
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
      minAndMaxAmount:
        minAndMaxAmount && minAndMaxAmount[0] && minAndMaxAmount[1]
          ? [minAndMaxAmount[0] + additionalAmount, minAndMaxAmount[1] + additionalAmount]
          : minAndMaxAmount,
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

  let requestBody = {
    user: walletAddress,
    originChainId: chainData.id,
    destinationChainId: dstChainId,
    currency: nativeToken.toLowerCase(),
    recipient: walletAddress,
    amount: amountWei.toString(),
    usePermit: false,
    useExternalLiquidity: false,
    source: 'relay.link',
  };

  const headers = getHeaders(HEADERS);
  const config = await getAxiosConfig({
    proxyAgent,
    headers,
  });

  const { data } = await axios.post(API_URL, requestBody, config);

  let gasFee = data.fees.gas.amount;
  let relayerFee = data.fees.relayer.amount;
  let parsedRelayerFee = parseFloat(formatEther(relayerFee));
  let resAmount = amountWei - (BigInt(relayerFee) * 2n + BigInt(gasFee));

  while (parsedRelayerFee > maxFee) {
    await sleep(
      90,
      {},
      logger,
      `Current fee ${getTrimmedLogsAmount(parsedRelayerFee)} is more than ${getTrimmedLogsAmount(
        maxFee
      )}. Waiting 90s...`
    );

    const { data } = await axios.post(API_URL, requestBody, config);

    gasFee = data.fees.gas.amount;
    relayerFee = data.fees.relayer.amount;
    parsedRelayerFee = parseFloat(formatEther(relayerFee));
    resAmount = amountWei - (BigInt(relayerFee) * 2n + BigInt(gasFee));
  }

  requestBody = {
    ...requestBody,
    amount: resAmount.toString(),
  };

  const { data: newData } = await axios.post(API_URL, requestBody, config);

  const txData = newData.steps[0].items[0].data;

  const logAmount = getTrimmedLogsAmount(amountInt, currentToken);
  logger.info(`Making bridge of [${logAmount}] from [${currentNetwork}] to [${destinationNetwork}].`);

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network: currentNetwork,
    publicClient,
  });
  const txHash = await walletClient.sendTransaction({
    to: txData.to,
    data: txData.data,
    value: BigInt(+txData.value),
    ...feeOptions,
  });

  await currentClient.waitTxReceipt(txHash);

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
      tgMessage: `Relay [${currentNetwork}] > [${destinationNetwork}] | Amount [${logAmount}]`,
    };
  }

  return {
    status: 'error',
  };
};
