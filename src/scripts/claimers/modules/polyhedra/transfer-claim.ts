import { Hex } from 'viem';

import { defaultTokenAbi } from '../../../../clients/abi';
import { DB_NOT_CONNECTED, SECOND_ADDRESS_EMPTY_ERROR, CLAIM_STATUSES } from '../../../../constants';
import {
  calculateAmount,
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  getSpentGas,
  intToDecimal,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import logger from '../../../../logger';
import { TransformedModuleParams } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';
import { PolyhedraClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { DECIMALS } from './constants';
import { getBalance, getTransactionData, getTransactionsData } from './helpers';

export const execMakeTransferClaimPolyhedra = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make transfer claimed ZK...',
    transactionCallback: makeTransferClaimPolyhedra,
  });

const makeTransferClaimPolyhedra = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const {
    client,
    dbSource,
    proxyAgent,
    minAndMaxAmount,
    usePercentBalance,
    wallet,
    gweiRange,
    gasLimitRange,
    network,
  } = params;

  const { walletClient, walletAddress, publicClient, explorerLink } = client;

  let nativeBalance = 0;
  let claimGasSpent = 0;
  let currentBalance = 0;

  if (!dbSource) {
    return {
      status: 'critical',
      message: DB_NOT_CONNECTED,
    };
  }

  const dbRepo = dbSource.getRepository(PolyhedraClaimEntity);

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
    const { int } = await client.getNativeBalance();
    nativeBalance = +int.toFixed(6);

    const headers = getHeaders();
    const config = await getAxiosConfig({
      proxyAgent,
      headers,
    });

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

    currentBalance = await getBalance(client);

    const txsData = await getTransactionsData({
      config,
      walletAddress,
      network,
    });

    const amountToTransfer = calculateAmount({
      balance: currentBalance,
      minAndMaxAmount,
      usePercentBalance,
    });

    const claimTxData = txsData?.find(
      ({ method, to }: { method: null | string; to: { hash: string } }) =>
        method === 'claim' && to.hash.toLowerCase() === PROJECT_CONTRACTS.zkClaim?.toLowerCase()
    );

    if (!claimTxData) {
      throw new Error('Claim was not found');
    }

    if (amountToTransfer === 0) {
      throw new Error('Amount is zero');
    }

    claimGasSpent = getSpentGas(claimTxData.gas_price, claimTxData.gas_used);

    logger.info(`Sending ${amountToTransfer} ZK to ${secondAddress}...`);

    const txHash = await walletClient.writeContract({
      address: PROJECT_CONTRACTS.zkAddress as Hex,
      abi: defaultTokenAbi,
      functionName: 'transfer',
      args: [
        secondAddress as Hex,
        intToDecimal({
          amount: amountToTransfer,
          decimals: DECIMALS,
        }),
      ],
      ...feeOptions,
    });

    await client.waitTxReceipt(txHash);

    const transferData = await getTransactionData({
      config,
      txHash,
    });
    const transferGasSpent = transferData ? getSpentGas(transferData.gas_price, transferData.gas_used) : 0;

    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.TRANSFER_SUCCESS,
      balance: currentBalance - amountToTransfer,
      gasSpent: +(claimGasSpent + transferGasSpent).toFixed(6),
      nativeBalance,
      transferred: amountToTransfer,
      transferredTo: secondAddress,
    });

    return {
      status: 'success',
      txHash,
      explorerLink,
      message: getCheckClaimMessage(CLAIM_STATUSES.TRANSFER_SUCCESS),
    };
  } catch (err) {
    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.TRANSFER_ERROR,
      balance: currentBalance,
      nativeBalance,
      gasSpent: +claimGasSpent.toFixed(6),
      error: formatErrMessage(err),
    });

    throw err;
  }
};
