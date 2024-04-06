import { Hex } from 'viem';

import { defaultTokenAbi } from '../../clients/abi';
import { MIN_TOKEN_BALANCE_ERROR, SECOND_ADDRESS_EMPTY_ERROR } from '../../constants';
import {
  addNumberPercentage,
  calculateAmount,
  getCurrentBalanceByContract,
  getGasOptions,
  getRandomNumber,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../helpers';
import { TransformedModuleParams } from '../../types';

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
  } = params;
  const { walletClient, explorerLink, publicClient } = client;
  const { secondAddress } = wallet;

  if (!secondAddress) {
    return {
      status: 'error',
      message: SECOND_ADDRESS_EMPTY_ERROR,
    };
  }

  logger.info(`Transfer tokens to secondAddress [${secondAddress}]`);

  const {
    wei: weiBalance,
    int: intBalance,
    decimals,
    isNativeContract,
  } = await getCurrentBalanceByContract({ client, contractAddress });

  const amount = calculateAmount({
    balance: weiBalance,
    minAndMaxAmount,
    usePercentBalance,
    decimals,
    isBigInt: true,
  });

  if (intBalance < minTokenBalance) {
    return {
      status: 'warning',
      message: MIN_TOKEN_BALANCE_ERROR,
    };
  }

  let txHash;

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network,
    publicClient,
  });

  if (isNativeContract) {
    const gasPrice = await publicClient.getGasPrice();

    const reversedFee = getRandomNumber([20, 25]);
    const gasLimit = await publicClient.estimateGas({
      to: secondAddress as Hex,
      value: amount,
      data: '0x',
      ...feeOptions,
    });

    const fee = gasPrice * gasLimit;

    const feeWithPercent = BigInt(+addNumberPercentage(Number(fee), reversedFee).toFixed(0));
    const value = amount - feeWithPercent;

    txHash = await walletClient.sendTransaction({
      to: secondAddress as Hex,
      value,
      data: '0x',
      ...feeOptions,
    });
  } else {
    txHash = await walletClient.writeContract({
      address: contractAddress as Hex,
      abi: defaultTokenAbi,
      functionName: 'transfer',
      args: [secondAddress as Hex, amount],
      ...feeOptions,
    });
  }

  await client.waitTxReceipt(txHash);

  return {
    txHash,
    explorerLink,
    status: 'success',
  };
};

export const execMakeTransferToken = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: `Execute make transfer tokens by contract [${params.contractAddress}]...`,
    transactionCallback: makeTransferToken,
  });
