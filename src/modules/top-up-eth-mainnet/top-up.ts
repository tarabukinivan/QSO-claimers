import {
  getClientByNetwork,
  getGasOptions,
  getRandomItemFromArray,
  getRandomNumber,
  intToDecimal,
  sleep,
  subtractNumberPercentage,
  TransactionCallbackParams,
  TransactionCallbackResponse,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../helpers';
import { Cex, TransformedModuleParams } from '../../types';
import { makeBinanceWithdraw } from '../binance-withdraw';
import { makeOkxWithdraw } from '../okx-withdraw';

export const execMakeTopUp = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make top up ethereum via zkSync Era...',
    transactionCallback: makeTopUp,
  });

const makeTopUp = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const {
    client,
    minAmount,
    gweiRange,
    gasLimitRange,
    zkEraBridgeAmount,
    minNativeBalance,
    wallet,
    logger,
    checkZkEraBalance,
    minDestNativeBalance,
    network,
    balanceToLeft,
    reservePercentNetworkFee,
    randomCex,
    useUsd,
    nativePrices,
  } = params;

  const amount = getRandomNumber(zkEraBridgeAmount);
  const zkSyncBalanceToLeft = getRandomNumber(balanceToLeft);

  const { walletClient, walletAddress, publicClient, explorerLink } = client;

  const ethClient = getClientByNetwork('eth', wallet.privKey, logger);
  const { int: nativeBalance } = await ethClient.getNativeBalance();

  if (nativeBalance >= minNativeBalance) {
    return {
      status: 'success',
      message: `Native balance of ETH=${nativeBalance.toFixed(6)} in eth network already more than ${minNativeBalance}`,
    };
  }

  const amountToBridge = subtractNumberPercentage(amount, reservePercentNetworkFee);

  if (amountToBridge < minAmount) {
    return {
      status: 'error',
      message: `zkEraBridgeAmount must be more than ${minAmount} to make bridge`,
    };
  }

  const { int: zkSyncNativeBalance } = await client.getNativeBalance();

  let isToppedUp = true;

  // const isZkBalanceLowerMinToLeft = zkSyncNativeBalance < balanceToLeft[0];

  const shouldWithdraw =
    zkSyncBalanceToLeft + amount > zkSyncNativeBalance && zkSyncNativeBalance - amount < balanceToLeft[1];
  const amountToWithdraw = zkSyncBalanceToLeft ? zkSyncBalanceToLeft - zkSyncNativeBalance + amount : amount;

  if (shouldWithdraw) {
    const baseWithdrawParams = {
      wallet,
      logger,
      useUsd,
      nativePrices,
      tokenToWithdraw: 'ETH' as const,
      minAndMaxAmount: zkEraBridgeAmount,
      amount: amountToWithdraw,
      minTokenBalance: checkZkEraBalance ? minDestNativeBalance : 0,
      withMinAmountError: false,
    };

    const withdrawNetwork = 'zkSync';
    const cex: Cex = randomCex ? getRandomItemFromArray(randomCex) : 'okx';

    let res: TransactionCallbackResponse | undefined;
    if (cex === 'okx') {
      res = await makeOkxWithdraw({
        ...baseWithdrawParams,
        okxWithdrawNetwork: withdrawNetwork,
      });
    }

    if (cex === 'binance') {
      res = await makeBinanceWithdraw({
        ...baseWithdrawParams,
        binanceWithdrawNetwork: withdrawNetwork,
      });
    }

    const isWithRes = !!res && 'status' in res;
    isToppedUp = isWithRes && (res!.status === 'success' || res!.status === 'passed');
    const isFailedTopUp = isWithRes && !isToppedUp;

    if (isFailedTopUp) {
      return {
        status: res!.status,
        message: res!.message,
      };
    }

    if (isToppedUp && res!.message) {
      logger.success(res!.message);
    }
  }

  if (isToppedUp) {
    const value = intToDecimal({ amount: amountToBridge });

    logger.info(`Making bridge of ${amountToBridge.toFixed(6)} ETH`);

    const feeOptions = await getGasOptions({
      gweiRange,
      gasLimitRange,
      network,
      publicClient,
    });

    const txHash = await walletClient.writeContract({
      address: '0x000000000000000000000000000000000000800A',
      abi: [
        {
          inputs: [{ internalType: 'address', name: '_l1Receiver', type: 'address' }],
          name: 'withdraw',
          outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
          stateMutability: 'payable',
          type: 'function',
        },
      ],
      functionName: 'withdraw',
      args: [walletAddress],
      value,
      ...feeOptions,
    });

    await sleep(20);

    return {
      txHash,
      explorerLink,
      status: 'success',
    };
  }

  return {
    status: 'error',
  };
};
