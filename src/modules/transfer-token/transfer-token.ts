import { Hex } from 'viem';

import { defaultTokenAbi } from '../../clients/abi';
import { SECOND_ADDRESS_EMPTY_ERROR } from '../../constants';
import {
  addNumberPercentage,
  calculateAmount,
  decimalToInt,
  getCurrentBalanceByContract,
  getGasOptions,
  getRandomNetwork,
  getRandomNumber,
  getTrimmedLogsAmount,
  intToDecimal,
  TransactionCallbackParams,
  TransactionCallbackResponse,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../helpers';
import { Tokens, TransformedModuleParams } from '../../types';

export const makeTransferToken = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const {
    gweiRange,
    gasLimitRange,
    minAndMaxAmount,
    usePercentBalance,
    wallet,
    client,
    network,
    contractAddress,
    logger,
    minTokenBalance,
    balanceToLeft,
    minAmount,
    randomNetworks,
    useUsd,
    nativePrices,
  } = params;
  const { transferAddress } = wallet;

  if (!transferAddress) {
    return {
      status: 'critical',
      message: SECOND_ADDRESS_EMPTY_ERROR,
    };
  }

  logger.info(`Transfer tokens to transferAddress [${transferAddress}]`);

  let currentNetwork = network;
  let currentClient = client;

  const isNativeContract = contractAddress === 'native';
  const contractInfo = isNativeContract
    ? undefined
    : {
      name: contractAddress,
      address: contractAddress,
      abi: defaultTokenAbi,
    };
  const srcTokenSymbol = await currentClient.getNativeOrContractSymbol(isNativeContract, contractInfo);

  let currentToken = srcTokenSymbol as Tokens;

  const randomNetworksLength = randomNetworks?.length || 0;
  if (randomNetworksLength) {
    const res = await getRandomNetwork({
      wallet,
      randomNetworks,
      logger,
      useUsd,
      nativePrices,
      tokenContractInfo: contractInfo,
      minTokenBalance,
      client: currentClient,
      network: currentNetwork,
      token: currentToken as Tokens,
      isNativeToken: isNativeContract,
      isWithdrawal: false,
    });

    if ('status' in res) {
      return res as TransactionCallbackResponse;
    }
    currentClient = res.client;
    currentNetwork = res.network;
    currentToken = res.token;
  }

  const { walletClient, explorerLink, publicClient, walletAddress } = currentClient;

  const {
    wei: weiBalance,
    int: intBalance,
    decimals,
  } = await getCurrentBalanceByContract({ client: currentClient, contractAddress });

  if (intBalance < minTokenBalance) {
    return {
      status: 'passed',
      message: `Balance ${getTrimmedLogsAmount(
        intBalance,
        currentToken
      )} in ${currentNetwork} is lower than minTokenBalance ${minTokenBalance}`,
    };
  }

  let amount = calculateAmount({
    balance: weiBalance,
    minAndMaxAmount,
    usePercentBalance,
    decimals,
    isBigInt: true,
  });

  if (balanceToLeft && balanceToLeft[0] && balanceToLeft[1]) {
    const balanceToLeftInt = getRandomNumber(balanceToLeft);

    const balanceToLeftWei = intToDecimal({
      amount: balanceToLeftInt,
      decimals,
    });

    amount = weiBalance - balanceToLeftWei;

    if (intBalance - balanceToLeftInt <= 0) {
      return {
        status: 'warning',
        message: `Balance is ${getTrimmedLogsAmount(
          intBalance,
          currentToken
        )}  that is lower than balance to left ${getTrimmedLogsAmount(balanceToLeftInt, currentToken)}`,
      };
    }
  }

  const logCalculatedAmount = `${getTrimmedLogsAmount(
    decimalToInt({
      amount,
      decimals,
    }),
    currentToken
  )}`;

  if (minAmount && amount < minAmount) {
    return {
      status: 'warning',
      message: `Calculated amount [${logCalculatedAmount}] is lower than provided minAmount [${minAmount}]`,
    };
  }

  let txHash;

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network: currentNetwork,
    publicClient,
  });

  const transferMsg = `Transferring [${logCalculatedAmount}] in ${currentNetwork} to [${transferAddress}]...`;
  if (isNativeContract) {
    const gasPrice = await publicClient.getGasPrice();

    const reversedFee = getRandomNumber([20, 25]);
    const gasLimit = await publicClient.estimateGas({
      account: walletAddress,
      to: transferAddress as Hex,
      value: amount,
      data: '0x',
      ...feeOptions,
    });

    const fee = gasPrice * gasLimit;

    const feeWithPercent = BigInt(+addNumberPercentage(Number(fee), reversedFee).toFixed(0));
    let value = amount - feeWithPercent;

    if (value <= 0n) {
      value = amount;
      // return {
      //   status: 'passed',
      //   message: `Fee of transaction [${getTrimmedLogsAmount(
      //     decimalToInt({
      //       amount: feeWithPercent,
      //       decimals,
      //     }),
      //     tokenSymbol
      //   )}] is bigger than current balance [${getTrimmedLogsAmount(intBalance, tokenSymbol)}]`,
      // };
    }

    logger.info(transferMsg);

    txHash = await walletClient.sendTransaction({
      to: transferAddress as Hex,
      value,
      data: '0x',
      ...feeOptions,
    });
  } else {
    logger.info(transferMsg);

    txHash = await walletClient.writeContract({
      address: contractAddress as Hex,
      abi: defaultTokenAbi,
      functionName: 'transfer',
      args: [transferAddress as Hex, amount],
      ...feeOptions,
    });
  }

  await currentClient.waitTxReceipt(txHash);

  return {
    txHash,
    explorerLink,
    status: 'success',
    tgMessage: `Transferred ${logCalculatedAmount} in ${currentNetwork} to ${transferAddress}...`,
  };
};

export const execMakeTransferToken = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: `Execute make transfer tokens by contract [${params.contractAddress}]...`,
    transactionCallback: makeTransferToken,
  });
