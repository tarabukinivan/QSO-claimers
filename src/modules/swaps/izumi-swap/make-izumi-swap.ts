import { encodeFunctionData } from 'viem';

import { ZERO_TOKEN_CONTRACT } from '../../../constants';
import {
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
  getGasOptions,
  ResponseStatus,
} from '../../../helpers';
import { TransformedModuleParams } from '../../../types';
import { calculateMinAmountOut, getDeadline, getSwapsData, getSwapTgMessage } from '../helpers';
import { IZUMI_CONTRACTS, IZUMI_PATH_CONNECTOR, IZUMI_QUOTER_ABI, IZUMI_ROUTER_ABI } from './constants';

export const execMakeIzumiSwap = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make izumi swap...',
    transactionCallback: makeIzumiSwap,
  });

export const makeIzumiSwap = async ({
  client,
  gweiRange,
  gasLimitRange,
  pairs,
  minTokenBalance,
  usePercentBalance,
  minAndMaxAmount,
  slippage,
  network,
  moduleName,
  logger,
  contractPairs,
}: TransactionCallbackParams): TransactionCallbackReturn => {
  const { walletClient, explorerLink, publicClient } = client;

  const izumiContracts = IZUMI_CONTRACTS[network];

  if (!izumiContracts) {
    return {
      status: 'warning',
      message: `You provided an unsupported network [${network}] in the configuration of [${moduleName}] module`,
    };
  }

  const { router: routerContractByNetwork, quoter: quoterContractByNetwork } = izumiContracts;

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

  logger.info(`Swapping [${amountToSwapInt}] from ${srcToken} to ${dstToken}...`);

  if (!isNativeSrcTokenContract) {
    await client.approve(srcTokenContract, routerContractByNetwork, balanceSrcToken.wei, gweiRange, gasLimitRange);
  }

  const path = srcTokenContract + IZUMI_PATH_CONNECTOR + dstTokenContract.substring(2);
  const deadline = getDeadline();

  const minAmountOutData = await client.publicClient.readContract({
    address: quoterContractByNetwork,
    abi: IZUMI_QUOTER_ABI,
    functionName: 'swapAmount',
    args: [amountToSwapWei, path],
  });

  const [minAmountOut] = minAmountOutData as [bigint];
  const minAmountOutToSwap = await calculateMinAmountOut(minAmountOut, slippage);

  const txData = encodeFunctionData({
    abi: IZUMI_ROUTER_ABI,
    functionName: 'swapAmount',
    args: [
      {
        path,
        recipient: isNativeDstTokenContract ? ZERO_TOKEN_CONTRACT : client.walletAddress,
        amount: amountToSwapWei,
        minAcquired: minAmountOutToSwap,
        deadline,
      },
    ],
  });

  let txHash;

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network,
    publicClient,
  });

  if (isNativeSrcTokenContract || isNativeDstTokenContract) {
    const txExtraData = encodeFunctionData({
      abi: IZUMI_ROUTER_ABI,
      functionName: isNativeSrcTokenContract ? 'refundETH' : 'unwrapWETH9',
      args: isNativeSrcTokenContract ? [] : [minAmountOutToSwap, client.walletAddress],
    });

    txHash = await walletClient.writeContract({
      address: routerContractByNetwork,
      abi: IZUMI_ROUTER_ABI,
      functionName: 'multicall',
      args: [[txData, txExtraData]],
      value: isNativeSrcTokenContract ? amountToSwapWei : 0n,
      ...feeOptions,
    });
  } else {
    txHash = await walletClient.sendTransaction({
      to: routerContractByNetwork,
      data: txData,

      ...feeOptions,
    });
  }

  await client.waitTxReceipt(txHash);

  return {
    status: 'success',
    txHash,
    explorerLink,
    tgMessage: getSwapTgMessage(srcToken, dstToken, amountToSwapInt),
  };
};
