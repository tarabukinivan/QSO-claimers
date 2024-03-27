import { Hex, TransactionExecutionError } from 'viem';

import { defaultTokenAbi } from '../../../../clients/abi';
import { SECOND_ADDRESS_EMPTY_ERROR, TRANSFER_ERROR, TRANSFER_SUCCESS } from '../../../../constants';
import {
  calculateAmount,
  getGasOptions,
  intToDecimal,
  saveCheckerDataToCSV,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import logger from '../../../../logger';
import { TransformedModuleParams } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';
import { getCheckClaimMessage } from '../../utils';
import { DECIMALS, FILENAME } from './constants';
import { getBalance } from './helpers';

export const execMakeTransferClaimPolyhedra = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make transfer claimed ZK...',
    transactionCallback: makeTransferClaimPolyhedra,
  });

const makeTransferClaimPolyhedra = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, minAndMaxAmount, usePercentBalance, wallet, gweiRange, gasLimitRange, network } = params;

  const { walletClient, walletAddress, publicClient, explorerLink } = client;

  const baseCheckerData = {
    id: wallet.id,
    walletAddress,
    network,
  };
  const fileName = FILENAME;

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network,
    publicClient,
  });

  const currentBalance = await getBalance(client);

  const amountToTransfer = calculateAmount({
    balance: currentBalance,
    minAndMaxAmount,
    usePercentBalance,
  });

  try {
    const secondAddress = wallet.secondAddress;
    if (!secondAddress) {
      throw new Error(SECOND_ADDRESS_EMPTY_ERROR);
    }

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

    await saveCheckerDataToCSV({
      data: {
        ...baseCheckerData,
        status: TRANSFER_SUCCESS,
        claimAmount: 0,
        balance: currentBalance - amountToTransfer,
        transferred: amountToTransfer,
        transferredTo: secondAddress,
      },
      fileName,
    });

    return {
      status: 'success',
      txHash,
      explorerLink,
      message: getCheckClaimMessage(TRANSFER_SUCCESS),
    };
  } catch (err) {
    let errorMessage = (err as Error).message;

    if (err instanceof TransactionExecutionError) {
      errorMessage = err.shortMessage;
    }

    await saveCheckerDataToCSV({
      data: {
        ...baseCheckerData,
        status: TRANSFER_ERROR,
        claimAmount: 0,
        balance: currentBalance,
        error: errorMessage.replace(',', ''),
      },
      fileName,
    });

    throw err;
  }
};
