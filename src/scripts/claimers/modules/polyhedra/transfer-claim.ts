import { Hex, TransactionExecutionError } from 'viem';

import { defaultTokenAbi } from '../../../../clients/abi';
import { SECOND_ADDRESS_EMPTY_ERROR, TRANSFER_ERROR, TRANSFER_SUCCESS } from '../../../../constants';
import {
  calculateAmount,
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  getSpentGas,
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
import { getBalance, getTransactionData, getTransactionsData } from './helpers';

export const execMakeTransferClaimPolyhedra = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make transfer claimed ZK...',
    transactionCallback: makeTransferClaimPolyhedra,
  });

const makeTransferClaimPolyhedra = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, proxyAgent, minAndMaxAmount, usePercentBalance, wallet, gweiRange, gasLimitRange, network } = params;

  const { walletClient, walletAddress, publicClient, explorerLink } = client;

  const headers = getHeaders();
  const config = await getAxiosConfig({
    proxyAgent,
    headers,
  });

  const { int: nativeBalance } = await client.getNativeBalance();
  const baseCheckerData = {
    id: wallet.id,
    walletAddress,
    network,
    nativeBalance: nativeBalance.toFixed(6),
  };

  const fileName = FILENAME;

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network,
    publicClient,
  });

  const currentBalance = await getBalance(client);

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

  let claimGasSpent = 0;
  try {
    const secondAddress = wallet.secondAddress;
    if (!secondAddress) {
      throw new Error(SECOND_ADDRESS_EMPTY_ERROR);
    }

    const claimTxData = txsData?.find(
      ({ method, to }: { method: null | string; to: { hash: string } }) =>
        method === 'claim' && to.hash.toLowerCase() === PROJECT_CONTRACTS.zkClaim?.toLowerCase()
    );

    if (!claimTxData) {
      throw new Error('Claim was not found');
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

    await saveCheckerDataToCSV({
      data: {
        ...baseCheckerData,
        status: TRANSFER_SUCCESS,
        claimAmount: 0,
        balance: currentBalance - amountToTransfer,
        gasSpent: (claimGasSpent + transferGasSpent).toFixed(6),
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
        gasSpent: claimGasSpent.toFixed(6),
        error: errorMessage.replace(',', ''),
      },
      fileName,
    });

    throw err;
  }
};
