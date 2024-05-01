import { fromHex } from 'viem';

import { MORALIS_KEY } from '../../../../_inputs/settings';
import { CLAIM_STATUSES, DB_NOT_CONNECTED, EMPTY_MORALIS_KEY } from '../../../../constants';
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
import { PolyhedraClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { CLAIM_ABI, CONTRACT_MAP } from './constants';
import { getBalance, getProofData, getTransactionData } from './helpers';

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

  if (!MORALIS_KEY) {
    return {
      status: 'critical',
      message: EMPTY_MORALIS_KEY,
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
    const { int } = await client.getNativeBalance();
    nativeBalance = +int.toFixed(6);

    const headers = getHeaders();
    const config = await getAxiosConfig({
      proxyAgent,
      headers,
    });

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

    const feeOptions = await getGasOptions({
      gweiRange,
      gasLimitRange,
      network,
      publicClient,
    });

    currentBalance = await getBalance(client);

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
