import { INCH_KEY } from '../../../_inputs/settings';
import { NATIVE_TOKEN_CONTRACT } from '../../../constants';
import {
  TransactionCallbackParams,
  TransactionCallbackReturn,
  getAxiosConfig,
  transactionWorker,
  getGasOptions,
  sleep,
  ResponseStatus,
} from '../../../helpers';
import { TransformedModuleParams } from '../../../types';
import { getSwapsData, getSwapTgMessage } from '../helpers';
import { buildTxData, getRouterContract } from './helpers';

export const execMake1inchSwap = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make 1inch swap...',
    transactionCallback: make1inchSwap,
  });

export const make1inchSwap = async ({
  pairs,
  logger,
  client,
  network,
  slippage,
  gweiRange,
  gasLimitRange,
  moduleName,
  proxyAgent,
  minAndMaxAmount,
  minTokenBalance,
  usePercentBalance,
  contractPairs,
}: TransactionCallbackParams): TransactionCallbackReturn => {
  const { walletClient, explorerLink, publicClient, chainData } = client;

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

  if (!INCH_KEY) {
    return {
      status: 'critical',
      message: 'Please provide 1inch API key in the global settings',
    };
  }

  const config = await getAxiosConfig({
    proxyAgent,
    token: INCH_KEY,
  });
  const routerContract = await getRouterContract({ config, chainId: chainData.id });

  logger.info(`Swapping [${amountToSwapInt}] from ${srcToken} to ${dstToken}...`);

  if (!isNativeSrcTokenContract) {
    await client.approve(srcTokenContract, routerContract, balanceSrcToken.wei, gweiRange, gasLimitRange);
  }

  await sleep(5);

  const { tx } = await buildTxData({
    config,
    slippage,
    amount: amountToSwapWei,
    from: client.walletAddress,
    chainId: client.chainData.id,
    src: isNativeSrcTokenContract ? NATIVE_TOKEN_CONTRACT : srcTokenContract,
    dst: isNativeDstTokenContract ? NATIVE_TOKEN_CONTRACT : dstTokenContract,
  });

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network,
    publicClient,
  });

  const txHash = await walletClient.sendTransaction({
    to: routerContract,
    data: tx.data,
    value: BigInt(tx.value),
    ...feeOptions,
  });

  await client.waitTxReceipt(txHash);

  return {
    txHash,
    explorerLink,
    status: 'success',
    tgMessage: getSwapTgMessage(srcToken, dstToken, amountToSwapInt),
  };
};
