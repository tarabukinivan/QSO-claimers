import { fromHex } from 'viem';

import { CLAIMED_AND_SENT, CLAIMED_NOT_SENT, NOT_CLAIMED, NOT_ELIGIBLE } from '../../../../constants';
import {
  decimalToInt,
  getAxiosConfig,
  getHeaders,
  getSpentGas,
  saveCheckerDataToCSV,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { TransformedModuleParams } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';
import { getCheckClaimMessage } from '../../utils';
import { DECIMALS, FILENAME } from './constants';
import { getBalance, getProofData, getTransactionsData } from './helpers';

export const execMakeCheckClaimPolyhedra = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make check claim ZK...',
    transactionCallback: makeCheckClaimPolyhedra,
  });

const makeCheckClaimPolyhedra = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, network, wallet, proxyAgent } = params;

  const { walletAddress } = client;

  const { int: nativeBalance } = await client.getNativeBalance();
  const baseCheckerData = {
    id: wallet.id,
    walletAddress,
    network,
    nativeBalance: nativeBalance.toFixed(6),
  };
  const fileName = FILENAME;

  const headers = getHeaders();
  const config = await getAxiosConfig({
    proxyAgent,
    headers,
  });

  const getDataProps = {
    network,
    config,
    walletAddress,
  };
  const proofData = await getProofData(getDataProps);

  if (!proofData) {
    await saveCheckerDataToCSV({
      data: {
        ...baseCheckerData,
        status: NOT_ELIGIBLE,
        claimAmount: 0,
        balance: 0,
        transferred: 0,
      },
      fileName,
    });

    return {
      status: 'success',
      message: getCheckClaimMessage(NOT_ELIGIBLE),
    };
  }

  const amountWei = fromHex(proofData.amount, 'bigint');
  const amountInt = decimalToInt({
    amount: amountWei,
    decimals: DECIMALS,
  });

  const txsData = await getTransactionsData({
    config,
    walletAddress,
    network,
  });

  const claimTxData = txsData?.find(
    ({ method, to }: { method: null | string; to: { hash: string } }) =>
      method === 'claim' && to.hash.toLowerCase() === PROJECT_CONTRACTS.zkClaim?.toLowerCase()
  );

  const currentBalance = await getBalance(client);

  if (claimTxData) {
    const claimGasSpent = getSpentGas(claimTxData.gas_price, claimTxData.gas_used);

    if (currentBalance >= amountInt) {
      await saveCheckerDataToCSV({
        data: {
          ...baseCheckerData,
          status: CLAIMED_NOT_SENT,
          claimAmount: amountInt,
          balance: currentBalance,
          gasSpent: claimGasSpent.toFixed(6),
        },
        fileName,
      });

      return {
        status: 'success',
        message: getCheckClaimMessage(CLAIMED_NOT_SENT),
      };
    }

    const transferredTxData = txsData?.find(
      ({ method, to }: { method: null | string; to: { hash: string } }) =>
        method === 'transfer' && to.hash.toLowerCase() === PROJECT_CONTRACTS.zkAddress?.toLowerCase()
    );

    const claimTxParams = claimTxData?.decoded_input.parameters;
    if (currentBalance < amountInt) {
      const amountInt = decimalToInt({
        amount: BigInt(+claimTxParams[2].value),
        decimals: DECIMALS,
      });

      const transferredParams = transferredTxData?.decoded_input.parameters;
      const transferred = transferredParams
        ? decimalToInt({
            amount: BigInt(+transferredParams[1].value),
            decimals: DECIMALS,
          })
        : 'Unknown';
      const transferredTo = transferredParams ? transferredParams[0].value : 'Unknown';

      const transferGasSpent = transferredTxData
        ? getSpentGas(transferredTxData.gas_price, transferredTxData.gas_used)
        : 0;

      await saveCheckerDataToCSV({
        data: {
          ...baseCheckerData,
          status: CLAIMED_AND_SENT,
          claimAmount: amountInt,
          balance: currentBalance,
          gasSpent: (claimGasSpent + transferGasSpent).toFixed(6),
          transferred,
          transferredTo,
        },
        fileName,
      });

      return {
        status: 'success',
        message: getCheckClaimMessage(CLAIMED_AND_SENT),
      };
    }
  }

  await saveCheckerDataToCSV({
    data: {
      ...baseCheckerData,
      status: NOT_CLAIMED,
      claimAmount: amountInt,
      balance: currentBalance,
    },
    fileName,
  });

  return {
    status: 'success',
    message: getCheckClaimMessage(NOT_CLAIMED),
  };
};
