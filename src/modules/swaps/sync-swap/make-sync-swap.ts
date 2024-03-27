import { Hex, encodeAbiParameters, parseAbiParameters } from 'viem';

import { ZERO_TOKEN_CONTRACT } from '../../../constants';
import {
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
  getGasOptions,
  ResponseStatus,
} from '../../../helpers';
import { TransformedModuleParams } from '../../../types';
import { SWAP_TOKEN_CONTRACT_BY_NETWORK } from '../constants';
import { calculateMinAmountOut, getDeadline, getSwapsData, getSwapTgMessage } from '../helpers';
import {
  SYNC_SWAP_CLASSIC_POOL_ABI,
  SYNC_SWAP_CLASSIC_POOL_FACTORY_ABI,
  SYNC_SWAP_CONTRACTS,
  SYNC_SWAP_ROUTER_ABI,
} from './constants';

export const execMakeSyncSwap = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make sync swap...',
    transactionCallback: makeSyncSwap,
  });

export const makeSyncSwap = async ({
  moduleName,
  client,
  gweiRange,
  gasLimitRange,
  pairs,
  usePercentBalance,
  minAndMaxAmount,
  slippage,
  network,
  logger,
  minTokenBalance,
  contractPairs,
}: TransactionCallbackParams): TransactionCallbackReturn => {
  const { walletClient, explorerLink, publicClient } = client;

  const routerContractByNetwork = SYNC_SWAP_CONTRACTS[network]?.router;
  const poolFactoryContractByNetwork = SYNC_SWAP_CONTRACTS[network]?.classicPoolFactory;

  if (!routerContractByNetwork || !poolFactoryContractByNetwork || !SWAP_TOKEN_CONTRACT_BY_NETWORK[network]) {
    return {
      status: 'warning',
      message: `You provided an unsupported network [${network}] in the configuration of [${moduleName}] module`,
    };
  }

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
    dstTokenContract,
    srcTokenContract,
    srcToken,
    dstToken,
  } = swapsData;

  const poolAddress = await client.publicClient.readContract({
    address: poolFactoryContractByNetwork,
    abi: SYNC_SWAP_CLASSIC_POOL_FACTORY_ABI,
    functionName: 'getPool',
    args: [srcTokenContract, dstTokenContract],
  });

  if (poolAddress === ZERO_TOKEN_CONTRACT) {
    return {
      status: 'error',
      message: `Swap path ${srcToken} to ${dstToken} not found!`,
    };
  }

  logger.info(`Swapping [${amountToSwapInt}] from ${srcToken} to ${dstToken}...`);

  if (!isNativeSrcTokenContract) {
    await client.approve(srcTokenContract, routerContractByNetwork, balanceSrcToken.wei, gweiRange, gasLimitRange);
  }

  const withdrawMode = 1;
  const deadline = getDeadline();
  const swapData = encodeAbiParameters(parseAbiParameters('address, address, uint8'), [
    srcTokenContract,
    client.walletAddress,
    withdrawMode,
  ]);

  const steps = [
    {
      pool: poolAddress,
      data: swapData,
      callback: ZERO_TOKEN_CONTRACT,
      callbackData: '0x',
    },
  ];

  const paths = [
    {
      steps: steps,
      tokenIn: srcToken === 'ETH' ? ZERO_TOKEN_CONTRACT : srcTokenContract,
      amountIn: amountToSwapWei,
    },
  ];

  const minAmountOut = await client.publicClient.readContract({
    address: poolAddress as Hex,
    abi: SYNC_SWAP_CLASSIC_POOL_ABI,
    functionName: 'getAmountOut',
    args: [srcTokenContract, amountToSwapWei, client.walletAddress],
  });

  const minAmountOutToSwap = await calculateMinAmountOut(minAmountOut as bigint, slippage);

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network,
    publicClient,
  });
  const txHash = await walletClient.writeContract({
    address: routerContractByNetwork,
    abi: SYNC_SWAP_ROUTER_ABI,
    functionName: 'swap',
    args: [paths, minAmountOutToSwap, deadline],
    value: isNativeSrcTokenContract ? amountToSwapWei : 0n,
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
