import axios from 'axios';
import { Hex } from 'viem';

import { defaultTokenAbi } from '../../../clients/abi';
import { AMOUNT_IS_TOO_LOW_ERROR, NATIVE_TOKEN_CONTRACT } from '../../../constants';
import {
  calculateAmount,
  ClientType,
  CryptoCompareResult,
  decimalToInt,
  getAxiosConfig,
  getClientByNetwork,
  getExpectedBalance,
  getGasOptions,
  getHeaders,
  getRandomNumber,
  getTrimmedLogsAmount,
  intToDecimal,
  showLogMakeBridge,
  shuffleArray,
  sleep,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../helpers';
import { LoggerData, LoggerType } from '../../../logger';
import {
  NumberRange,
  ProxyAgent,
  SupportedNetworks,
  Tokens,
  TransformedModuleParams,
  WalletData,
} from '../../../types';

export const execMakeRouternitroBridge = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make routernitro bridge...',
    transactionCallback: makeRouternitroBridge,
  });

const API_URL = 'https://api-beta.pathfinder.routerprotocol.com/api/v2';

interface MakeRouternitroBridge {
  wallet: WalletData;
  logger: LoggerType;
  client: ClientType;
  preparedAmount?: bigint;
  destinationNetwork: SupportedNetworks;
  randomNetworks?: SupportedNetworks[];
  usePercentBalance?: boolean;
  contractAddress: Hex | 'native';
  minTokenBalance?: number;
  proxyAgent?: ProxyAgent;
  gweiRange?: NumberRange;
  expectedBalance?: NumberRange;
  network: SupportedNetworks;
  minDestTokenBalance?: number;
  minAndMaxAmount: NumberRange;
  minAmount?: number;
  slippage: number;
  useUsd?: boolean;
  maxFee?: number;
  balanceToLeft?: NumberRange;
  nativePrices: CryptoCompareResult;
}
export const makeRouternitroBridge = async (params: MakeRouternitroBridge): TransactionCallbackReturn => {
  const {
    client,
    proxyAgent,
    logger,
    destinationNetwork,
    contractAddress,
    wallet,
    minTokenBalance,
    randomNetworks,
    usePercentBalance,
    gweiRange,
    slippage,
    network: networkProp,
    minDestTokenBalance,
    minAndMaxAmount: minAndMaxAmountProp,
    minAmount: minAmountProp,
    expectedBalance,
    useUsd,
    nativePrices,
    preparedAmount,
    maxFee: maxFeeProp,
    balanceToLeft,
  } = params;
  const { currentExpectedBalance: currentExpectedBalancePicked, isTopUpByExpectedBalance } =
    getExpectedBalance(expectedBalance);

  let minAndMaxAmount = minAndMaxAmountProp;
  let minAmount = minAmountProp;
  let currentExpectedBalance = currentExpectedBalancePicked;
  let maxFee = maxFeeProp;

  const useRandom = useUsd && !!randomNetworks?.length && !!minTokenBalance;

  const isNativeContract = contractAddress === 'native';
  const contractInfo = isNativeContract
    ? undefined
    : {
        name: contractAddress,
        address: contractAddress,
        abi: defaultTokenAbi,
      };

  const logTemplate: LoggerData = {
    action: 'execRouternitroBridge',
  };
  const destinationClient = getClientByNetwork(destinationNetwork, wallet.privKey, logger);

  let network = networkProp;
  let currentClient = client;
  let fromChainId = currentClient.chainData.id;
  let fromTokenSymbol = await currentClient.getNativeOrContractSymbol(isNativeContract, contractInfo);

  const randomClients =
    randomNetworks?.map((network) => ({
      network,
      client: getClientByNetwork(network, wallet.privKey, logger),
    })) || [];
  const shuffledRandomClients = shuffleArray(randomClients);

  if (useRandom) {
    for (const randomNetworkData of shuffledRandomClients) {
      const client = randomNetworkData.client;
      const randomNetwork = randomNetworkData.network;

      const randomNetworkBalance = await client.getNativeOrContractBalance(isNativeContract, contractInfo);
      const randomNetworkTokenSymbol = await client.getNativeOrContractSymbol(isNativeContract, contractInfo);

      const randomTokenPrice = nativePrices[randomNetworkTokenSymbol];

      if (!randomTokenPrice) {
        throw new Error(`Unable to get ${randomNetworkTokenSymbol} token price`);
      }

      if (randomNetworkBalance.int > minTokenBalance / randomTokenPrice) {
        network = randomNetwork;
        currentClient = client;
        fromChainId = client.chainData.id;
        fromTokenSymbol = randomNetworkTokenSymbol;

        break;
      }
    }
  }

  if (useUsd) {
    const currentTokenPrice = nativePrices[fromTokenSymbol];

    if (!currentTokenPrice) {
      throw new Error(`Unable to get ${fromTokenSymbol} token price`);
    }

    if (minAmount) {
      minAmount = minAmount / currentTokenPrice;
    }

    currentExpectedBalance = currentExpectedBalance / currentTokenPrice;

    if (!usePercentBalance) {
      minAndMaxAmount = [minAndMaxAmount[0] / currentTokenPrice, minAndMaxAmount[1] / currentTokenPrice];
    }
  }

  const { walletClient, explorerLink, walletAddress, publicClient } = currentClient;

  const toChainId = destinationClient.chainData.id;

  const balance = await currentClient.getNativeOrContractBalance(isNativeContract, contractInfo);

  const destinationBalance = await destinationClient.getNativeOrContractBalance(isNativeContract, contractInfo);

  if (minDestTokenBalance && destinationBalance.int >= minDestTokenBalance) {
    return {
      status: 'passed',
      message: `Balance in ${destinationNetwork} is ${getTrimmedLogsAmount(
        destinationBalance.int
      )} already more or equal than ${minDestTokenBalance}`,
    };
  }

  let amount;

  if (balanceToLeft && balanceToLeft[0] && balanceToLeft[1]) {
    let balanceToLeftInt = getRandomNumber(balanceToLeft);

    if (useUsd) {
      const fromTokenPrice = nativePrices[fromTokenSymbol];

      if (!fromTokenPrice) {
        throw new Error(`Unable to get ${fromTokenSymbol} token price`);
      }

      balanceToLeftInt = balanceToLeftInt / fromTokenPrice;
    }

    const balanceToLeftWei = intToDecimal({
      amount: balanceToLeftInt,
      decimals: balance.decimals,
    });

    amount = balance.wei - balanceToLeftWei;

    if (balance.int - balanceToLeftInt <= 0) {
      return {
        status: 'warning',
        message: `Balance is ${getTrimmedLogsAmount(
          balance.int,
          fromTokenSymbol as Tokens
        )} that is lower than balance to left ${balanceToLeftInt}`,
      };
    }
  } else if (isTopUpByExpectedBalance && !preparedAmount) {
    const toTokenSymbol = destinationClient.chainData.nativeCurrency.symbol;

    if (fromTokenSymbol !== toTokenSymbol) {
      const fromTokenPrice = nativePrices[fromTokenSymbol];
      const toTokenPrice = nativePrices[toTokenSymbol];

      if (!fromTokenPrice) {
        throw new Error(`Unable to get ${fromTokenSymbol} token price`);
      }
      if (!toTokenPrice) {
        throw new Error(`Unable to get ${toTokenPrice} token price`);
      }

      const convertedByPriceExpectedBalance = (currentExpectedBalance * toTokenPrice) / fromTokenPrice;

      amount = intToDecimal({
        amount: convertedByPriceExpectedBalance - destinationBalance.int,
        decimals: destinationBalance.decimals,
      });
    } else {
      amount = intToDecimal({
        amount: currentExpectedBalance - destinationBalance.int,
        decimals: destinationBalance.decimals,
      });
    }
  } else {
    amount =
      preparedAmount ||
      calculateAmount({
        balance: balance.wei,
        isBigInt: true,
        minAndMaxAmount,
        usePercentBalance,
        decimals: balance.decimals,
      });
  }

  const amountInt = decimalToInt({
    amount,
    decimals: balance.decimals,
  });

  if (amountInt < (minAmount || 0)) {
    return {
      status: 'warning',
      message: AMOUNT_IS_TOO_LOW_ERROR,
    };
  }

  const headers = getHeaders({
    'sec-fetch-site': 'cross-site',
    origin: 'https://app.routernitro.com',
  });
  const config = await getAxiosConfig({
    proxyAgent,
    headers,
    withoutAbort: true,
  });

  const tokenContract = isNativeContract ? NATIVE_TOKEN_CONTRACT : contractAddress;

  const quoteRes = await axios.get(
    `${API_URL}/quote?fromTokenAddress=${tokenContract}&toTokenAddress=${tokenContract}&amount=${amount}&fromTokenChainId=${fromChainId}&toTokenChainId=${toChainId}&partnerId=1`,
    config
  );

  let data = quoteRes.data;

  let currentFee = decimalToInt({ amount: data.bridgeFee.amount, decimals: data.bridgeFee.decimals });
  if (maxFee) {
    const feeSymbol = data.bridgeFee.symbol;

    if (feeSymbol !== fromTokenSymbol) {
      const feeTokenPrice = nativePrices[feeSymbol];
      const currentTokenPrice = nativePrices[fromTokenSymbol];

      if (!feeTokenPrice) {
        throw new Error(`Unable to get ${feeSymbol} token price`);
      }
      if (!currentTokenPrice) {
        throw new Error(`Unable to get ${fromTokenSymbol} token price`);
      }

      maxFee = useUsd ? maxFee / feeTokenPrice : (maxFee * currentTokenPrice) / feeTokenPrice;
    }

    while (currentFee > maxFee) {
      await sleep(
        90,
        logTemplate,
        logger,
        `Current fee ${getTrimmedLogsAmount(currentFee)} is more than ${getTrimmedLogsAmount(maxFee)}. Waiting 90s...`
      );

      const quoteRes = await axios.get(
        `${API_URL}/quote?fromTokenAddress=${tokenContract}&toTokenAddress=${tokenContract}&amount=${amount}&fromTokenChainId=${fromChainId}&toTokenChainId=${toChainId}&partnerId=1`,
        config
      );
      data = quoteRes.data;
      currentFee = decimalToInt({ amount: data.bridgeFee.amount, decimals: data.bridgeFee.decimals });
    }
  }

  const lcNativeContract = NATIVE_TOKEN_CONTRACT.toLowerCase();

  const fromTokenAddress = data.fromTokenAddress?.toLowerCase();
  const toTokenAddress = data.toTokenAddress?.toLowerCase();

  const incorrectQuote =
    isNativeContract && (fromTokenAddress !== lcNativeContract || toTokenAddress !== lcNativeContract);

  if (incorrectQuote) {
    return {
      status: 'error',
      message: `Data from routernitro is incorrect. Got from token ${fromTokenAddress} and to token ${toTokenAddress}`,
    };
  }

  const { data: txData } = await axios.post(
    `${API_URL}/transaction`,
    {
      ...data,
      receiverAddress: walletAddress,
      senderAddress: walletAddress,
      slippageTolerance: slippage,
    },
    config
  );

  const fromTxTokenAddress = data.fromTokenAddress?.toLowerCase();
  const toTxTokenAddress = data.toTokenAddress?.toLowerCase();

  const incorrectTx =
    isNativeContract && (fromTxTokenAddress !== lcNativeContract || toTxTokenAddress !== lcNativeContract);

  if (incorrectTx) {
    return {
      status: 'error',
      message: `Data from routernitro is incorrect. Got from token ${fromTxTokenAddress} and to token ${toTxTokenAddress}`,
    };
  }

  const txn = txData.txn;

  showLogMakeBridge({
    logger,
    amount: amountInt,
    network,
    destinationNetwork,
    token: fromTokenSymbol as unknown as Tokens,
  });

  const feeOptions = await getGasOptions({
    gweiRange,
    network,
    publicClient,
  });

  const txHash = await walletClient.sendTransaction({
    to: txn.to,
    value: amount,
    data: txn.data,
    ...feeOptions,
  });

  await currentClient.waitTxReceipt(txHash);

  const maxTimeToWait = 180;
  let totalWaitingTime = 0;
  let currentDestinationBalance = await destinationClient.getNativeOrContractBalance(isNativeContract, contractInfo);
  let errMessage;
  while (!(currentDestinationBalance.int > destinationBalance.int) && !errMessage) {
    const sleepSeconds = 35;

    totalWaitingTime += sleepSeconds;

    if (totalWaitingTime >= maxTimeToWait) {
      const currentBalance = await currentClient.getNativeOrContractBalance(isNativeContract, contractInfo);

      if (currentBalance.int < balance.int - amountInt) {
        totalWaitingTime = 0;
      } else {
        errMessage = 'Probably bridge was canceled';
      }
    }

    await sleep(
      sleepSeconds,
      logTemplate,
      logger,
      `Fell asleep for ${sleepSeconds} seconds, bridge still in progress...`
    );

    try {
      await publicClient.getTransaction({
        hash: txHash,
      });
    } catch (err) {
      const errMsg = (err as Error).message;

      const txNotFoundMessageP1 = 'transaction with hash';
      const txNotFoundMessageP2 = 'could not be found';

      const isTxNotFound =
        errMsg.toLowerCase().includes(txNotFoundMessageP1) && errMsg.toLowerCase().includes(txNotFoundMessageP2);
      if (isTxNotFound) {
        errMessage = 'Transaction could not be found. Probably it was canceled';
      }

      throw err;
    }

    currentDestinationBalance = await destinationClient.getNativeOrContractBalance(isNativeContract, contractInfo);
  }

  if (errMessage) {
    return {
      status: 'error',
      message: errMessage,
    };
  }

  return {
    status: 'success',
    txHash,
    explorerLink,
  };
};
