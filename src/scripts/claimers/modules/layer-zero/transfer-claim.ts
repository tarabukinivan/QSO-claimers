import { getAddress } from 'viem';

import { defaultTokenAbi } from '../../../../clients/abi';
import {
  CLAIM_STATUSES,
  CLAIM_TX_NOT_FOUND,
  DB_NOT_CONNECTED,
  SECOND_ADDRESS_EMPTY_ERROR,
  ZERO_TRANSFER_AMOUNT,
} from '../../../../constants';
import {
  calculateAmount,
  decimalToInt,
  getGasOptions,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { TransformedModuleParams } from '../../../../types';
import { LayerZeroClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { ZRO_ABI, ZRO_CLAIM_CONTRACTS, ZRO_CLAIMER_CONTRACTS, ZRO_CONTRACT } from './constants';
import { getBalance } from './helpers';

export const execMakeTransferClaimLayerZero = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make transfer claimed $ZRO...',
    transactionCallback: makeTransferClaimLayerZero,
  });

const makeTransferClaimLayerZero = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, dbSource, minAndMaxAmount, usePercentBalance, wallet, gweiRange, gasLimitRange, network, logger } =
    params;

  const { walletClient, walletAddress, publicClient, explorerLink } = client;

  let nativeBalance = 0;
  let currentBalance = 0;

  if (!dbSource) {
    return {
      status: 'critical',
      message: DB_NOT_CONNECTED,
    };
  }

  const dbRepo = dbSource.getRepository(LayerZeroClaimEntity);

  let walletInDb = await dbRepo.findOne({
    where: {
      walletId: wallet.id,
      index: wallet.index,
    },
  });
  if (walletInDb) {
    await dbRepo.remove(walletInDb);
  }

  const created = dbRepo.create({
    walletId: wallet.id,
    index: wallet.index,
    walletAddress,
    network,
    nativeBalance,
    status: 'New',
  });
  walletInDb = await dbRepo.save(created);

  try {
    const zroClaimedContract = ZRO_CLAIMER_CONTRACTS[network];
    const contract = ZRO_CLAIM_CONTRACTS[network];
    if (!contract || !zroClaimedContract) {
      throw new Error(`Network ${network} is not supported`);
    }

    const { int } = await client.getNativeBalance();
    nativeBalance = +int.toFixed(6);

    const claimed = (await publicClient.readContract({
      address: zroClaimedContract,
      abi: ZRO_ABI,
      functionName: 'zroClaimed',
      args: [walletAddress],
    })) as bigint;

    if (claimed === 0n) {
      await dbRepo.update(walletInDb.id, {
        status: CLAIM_STATUSES.NOT_CLAIMED,
        nativeBalance,
        balance: currentBalance,
      });

      return {
        status: 'passed',
        message: getCheckClaimMessage(CLAIM_STATUSES.NOT_CLAIMED),
      };
    }

    const secondAddress = wallet.secondAddress;
    if (!secondAddress) {
      throw new Error(SECOND_ADDRESS_EMPTY_ERROR);
    }

    const feeOptions = await getGasOptions({
      gweiRange,
      gasLimitRange,
      network,
      publicClient,
    });

    const { currentBalance: currentBalanceInt, currentBalanceWei } = await getBalance(client);
    currentBalance = currentBalanceInt;

    const amountToTransfer = calculateAmount({
      balance: currentBalanceWei,
      isBigInt: true,
      minAndMaxAmount,
      usePercentBalance,
      decimals: 18,
    });

    const isEmptyAmount = amountToTransfer === 0n;

    if (isEmptyAmount) {
      throw new Error(ZERO_TRANSFER_AMOUNT);
    }

    const amountToTransferInt = decimalToInt({
      amount: amountToTransfer,
      decimals: 18,
    });
    logger.info(`Sending ${amountToTransferInt} $ZRO to ${secondAddress}...`);

    const txHash = await walletClient.writeContract({
      address: ZRO_CONTRACT,
      abi: defaultTokenAbi,
      functionName: 'transfer',
      args: [getAddress(secondAddress), amountToTransfer],
      ...feeOptions,
    });

    await client.waitTxReceipt(txHash);

    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.TRANSFER_SUCCESS,
      balance: currentBalance - amountToTransferInt,
      nativeBalance,
      transferred: amountToTransferInt,
      transferredTo: secondAddress,
    });

    return {
      tgMessage: `Sent ${amountToTransfer} $ZRO to ${secondAddress}`,
      status: 'success',
      txHash,
      explorerLink,
      message: getCheckClaimMessage(CLAIM_STATUSES.TRANSFER_SUCCESS),
    };
  } catch (err) {
    const errMessage = formatErrMessage(err);
    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.TRANSFER_ERROR,
      balance: currentBalance,
      nativeBalance,
      error: errMessage,
    });

    if (errMessage === CLAIM_TX_NOT_FOUND || errMessage === ZERO_TRANSFER_AMOUNT) {
      return {
        status: 'warning',
        message: errMessage,
      };
    }

    throw err;
  }
};
