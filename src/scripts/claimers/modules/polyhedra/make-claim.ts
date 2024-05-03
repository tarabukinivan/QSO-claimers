import { fromHex } from 'viem';

import { CLAIM_STATUSES, DB_NOT_CONNECTED } from '../../../../constants';
import {
  decimalToInt,
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  getSpentGas,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { TransformedModuleParams } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';
import { PolyhedraClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { CLAIM_ABI, CONTRACT_MAP } from './constants';
import { getBalance, getProofData, getTransactionData, getTransactionsData } from './helpers';

export const execMakeClaimPolyhedra = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make claim ZK...',
    transactionCallback: makeClaimPolyhedra,
  });

const makeClaimPolyhedra = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, dbSource, gweiRange, gasLimitRange, wallet, network, proxyAgent } = params;

  const { walletAddress, walletClient, publicClient, explorerLink } = client;

  if (!dbSource) {
    return {
      status: 'critical',
      message: DB_NOT_CONNECTED,
    };
  }

  let nativeBalance = 0;
  let amountInt = 0;
  let currentBalance = 0;

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
    const contract = CONTRACT_MAP[network];
    if (!contract) {
      return {
        status: 'warning',
        message: `Unsupported network ${network}`,
      };
    }

    const headers = getHeaders();
    const config = await getAxiosConfig({
      proxyAgent,
      headers,
    });

    const { int } = await client.getNativeBalance();
    nativeBalance = +int.toFixed(6);

    const proofData = await getProofData({
      network,
      config,
      walletAddress,
      chainId: client.chainData.id,
    });
    if (!proofData) {
      await dbRepo.update(walletInDb.id, {
        status: CLAIM_STATUSES.NOT_ELIGIBLE,
      });

      return {
        status: 'passed',
        message: getCheckClaimMessage(CLAIM_STATUSES.NOT_ELIGIBLE),
      };
    }

    const amountWei = fromHex(proofData.amount, 'bigint');
    amountInt = decimalToInt({
      amount: amountWei,
      decimals: 18,
    });

    currentBalance = await getBalance(client);

    const txsData = await getTransactionsData({
      config,
      walletAddress,
      network,
      chainId: client.chainData.id,
    });

    const claimTxData = txsData?.find(
      ({
        method,
        to,
        input,
        to_address,
      }: {
        method: null | string;
        to: { hash: string };
        input: string;
        to_address: string;
      }) => {
        const toContractLc = contract.toLowerCase();

        return network === 'bsc'
          ? input.startsWith('0x2e7ba6ef') && to_address.toLowerCase() === toContractLc
          : method === 'claim' && to.hash.toLowerCase() === toContractLc;
      }
    );

    // TODO: Move to separate helper
    if (claimTxData) {
      const claimGasSpent = getSpentGas(claimTxData.gas_price, claimTxData.gas_used || claimTxData.receipt_gas_used);

      if (currentBalance >= amountInt) {
        await dbRepo.update(walletInDb.id, {
          status: CLAIM_STATUSES.CLAIMED_NOT_SENT,
          claimAmount: amountInt,
          nativeBalance,
          balance: currentBalance,
          gasSpent: +claimGasSpent.toFixed(6),
        });

        return {
          status: 'success',
          message: getCheckClaimMessage(CLAIM_STATUSES.CLAIMED_NOT_SENT),
        };
      }

      const transferredTxData = txsData?.find(
        ({
          method,
          to,
          input,
          to_address,
        }: {
          method: null | string;
          to: { hash: string };
          input: string;
          to_address: string;
        }) => {
          const toContractLc = PROJECT_CONTRACTS.zkAddress?.toLowerCase();
          return network === 'bsc'
            ? input.startsWith('0xa9059cbb') && to_address.toLowerCase() === toContractLc
            : method === 'transfer' && to.hash.toLowerCase() === toContractLc;
        }
      );

      if (currentBalance < amountInt) {
        const transferred = amountInt - currentBalance;

        const transferGasSpent = transferredTxData
          ? getSpentGas(transferredTxData.gas_price, transferredTxData.gas_used)
          : 0;

        await dbRepo.update(walletInDb.id, {
          status: CLAIM_STATUSES.CLAIMED_AND_SENT,
          claimAmount: amountInt,
          balance: currentBalance,
          gasSpent: +(claimGasSpent + transferGasSpent).toFixed(6),
          nativeBalance,
          transferred,
        });

        return {
          status: 'success',
          message: getCheckClaimMessage(CLAIM_STATUSES.CLAIMED_AND_SENT),
        };
      }
    }

    const feeOptions = await getGasOptions({
      gweiRange,
      gasLimitRange,
      network,
      publicClient,
    });

    const txHash = await walletClient.writeContract({
      address: contract,
      abi: CLAIM_ABI,
      functionName: 'claim',
      args: [proofData.index, walletAddress, amountWei, proofData.proof],
      ...feeOptions,
    });

    await client.waitTxReceipt(txHash);

    const claimData = await getTransactionData({
      config,
      txHash,
      chainId: client.chainData.id,
      network,
    });

    const claimGasSpent = claimData ? getSpentGas(claimData.gas_price, claimData.gas_used) : 0;

    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.CLAIM_SUCCESS,
      claimAmount: amountInt,
      nativeBalance,
      balance: currentBalance + amountInt,
      gasSpent: +claimGasSpent.toFixed(6),
    });

    return {
      status: 'success',
      txHash,
      explorerLink,
      message: getCheckClaimMessage(CLAIM_STATUSES.CLAIM_SUCCESS),
    };
  } catch (err) {
    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.CLAIM_ERROR,
      claimAmount: amountInt,
      nativeBalance,
      balance: currentBalance,
      error: formatErrMessage(err),
    });

    throw err;
  }
};
