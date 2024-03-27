import { fromHex, Hex, TransactionExecutionError } from 'viem';

import { CLAIM_ERROR, CLAIM_SUCCESS, NOT_ELIGIBLE } from '../../../../constants';
import {
  decimalToInt,
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  saveCheckerDataToCSV,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { TransformedModuleParams } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';
import { getCheckClaimMessage } from '../../utils';
import { CLAIM_ABI, FILENAME } from './constants';
import { getBalance, getProofData } from './helpers';

export const execMakeClaimPolyhedra = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make claim ZK...',
    transactionCallback: makeClaimPolyhedra,
  });

const makeClaimPolyhedra = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, gweiRange, gasLimitRange, wallet, network, proxyAgent } = params;

  const { walletAddress, walletClient, publicClient, explorerLink } = client;

  const baseCheckerData = {
    id: wallet.id,
    walletAddress,
    network,
  };
  const fileName = FILENAME;

  const headers = getHeaders();
  const config = await getAxiosConfig({
    proxyAgent,
    headers,
  });

  const proofData = await getProofData({
    network,
    config,
    walletAddress,
  });
  if (!proofData) {
    throw new Error(NOT_ELIGIBLE);
  }

  const amountWei = fromHex(proofData.amount, 'bigint');
  const amountInt = decimalToInt({
    amount: amountWei,
    decimals: 18,
  });

  const feeOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network,
    publicClient,
  });

  const currentBalance = await getBalance(client);

  try {
    const txHash = await walletClient.writeContract({
      address: PROJECT_CONTRACTS.zkClaim as Hex,
      abi: CLAIM_ABI,
      functionName: 'claim',
      args: [proofData.index, walletAddress, amountWei, proofData.proof],
      ...feeOptions,
    });

    await client.waitTxReceipt(txHash);

    await saveCheckerDataToCSV({
      data: {
        ...baseCheckerData,
        status: CLAIM_SUCCESS,
        claimAmount: amountInt,
        balance: currentBalance + amountInt,
      },
      fileName,
    });

    return {
      status: 'success',
      txHash,
      explorerLink,
      message: getCheckClaimMessage(CLAIM_SUCCESS),
    };
  } catch (err) {
    let errorMessage = (err as Error).message;

    if (err instanceof TransactionExecutionError) {
      errorMessage = err.shortMessage;
    }

    await saveCheckerDataToCSV({
      data: {
        ...baseCheckerData,
        status: CLAIM_ERROR,
        claimAmount: amountInt,
        balance: currentBalance,
        error: errorMessage.replace(',', ''),
      },
      fileName,
    });

    throw err;
  }
};
