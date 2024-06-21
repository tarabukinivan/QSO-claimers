import { checksumAddress } from 'viem';

import { ZERO_TOKEN_CONTRACT } from '../../../constants';
import {
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
  getGasOptions,
  getAxiosConfig,
  ResponseStatus,
  showLogMakeSwap,
} from '../../../helpers';
import { TransformedModuleParams } from '../../../types';
import { getSwapsData, getSwapTgMessage } from '../helpers';
import { assembleTx, getQuote } from './utils';

export const execMakeOdosSwap = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make odos swap...',
    transactionCallback: makeOdosSwap,
  });

export const makeOdosSwap = async ({
  pairs,
  logger,
  client,
  network,
  slippage,
  gweiRange,
  gasLimitRange,
  proxyAgent,
  moduleName,
  minAndMaxAmount,
  minTokenBalance,
  usePercentBalance,
  contractPairs,
}: TransactionCallbackParams): TransactionCallbackReturn => {
  const { walletClient, explorerLink, publicClient } = client;

  const swapsData = await getSwapsData({
    moduleName,
    client,
    contractPairs,
    pairs,
    minTokenBalance,
    network,
    minAndMaxAmount,
    usePercentBalance,
  });
  if ('status' in swapsData && !!swapsData) {
    return {
      status: swapsData.status as ResponseStatus,
      message: swapsData.message,
    };
  }

  const {
    balanceSrcToken,
    amountToSwapInt,
    amountToSwapWei,
    isNativeSrcTokenContract,
    isNativeDstTokenContract,
    dstTokenContract,
    srcTokenContract,
    srcToken,
    dstToken,
  } = swapsData;

  const config = await getAxiosConfig({
    proxyAgent,
  });

  const pathId = await getQuote({
    config,
    slippage,
    amount: amountToSwapWei,
    chainId: client.chainData.id,
    walletAddress: client.walletAddress,
    srcTokenContract: isNativeSrcTokenContract ? ZERO_TOKEN_CONTRACT : srcTokenContract,
    dstTokenContract: isNativeDstTokenContract ? ZERO_TOKEN_CONTRACT : dstTokenContract,
  });
  const txData = await assembleTx({
    config,
    pathId,
    walletAddress: client.walletAddress,
  });
  const toContract = checksumAddress(txData.to);

  showLogMakeSwap({
    amount: amountToSwapInt,
    logger,
    srcToken,
    dstToken,
  });

  if (!isNativeSrcTokenContract) {
    await client.approve(srcTokenContract, toContract, balanceSrcToken.wei, gweiRange, gasLimitRange);
  }

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network,
    publicClient,
  });

  const txHash = await walletClient.sendTransaction({
    to: toContract,
    data: txData.data,
    value: BigInt(txData.value),
    ...feeOptions,
  });

  await client.waitTxReceipt(txHash);

  return {
    status: 'success',
    txHash,
    explorerLink,
    tgMessage: getSwapTgMessage(srcToken, dstToken, amountToSwapInt),
  };
};
