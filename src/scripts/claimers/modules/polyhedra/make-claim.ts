import { fromHex, Hex } from 'viem';

import { CLAIM_STATUSES, DB_NOT_CONNECTED } from '../../../../constants';
import {
  decimalToInt,
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { Moralis } from '../../../../managers/moralis';
import { TransformedModuleParams } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';
import { PolyhedraClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { CLAIM_ABI, CONTRACT_MAP } from './constants';
import { getBalance, getProofData } from './helpers';

export const execMakeClaimPolyhedra = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make claim ZK...',
    transactionCallback: makeClaimPolyhedra,
  });

const makeClaimPolyhedra = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, dbSource, gweiRange, gasLimitRange, wallet, network, proxyAgent } = params;

  const moralis = new Moralis();

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

    const txsData = await moralis.getTxs({
      walletAddress,
      chainId: client.chainData.id,
    });

    const claimTxData = moralis.getTxData({
      txs: txsData,
      method: '0x2e7ba6ef',
      to: contract,
    });

    if (claimTxData) {
      const claimGasSpent = moralis.getSpentGas(claimTxData);

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

      const transferredTxData = moralis.getTxData({
        txs: txsData,
        method: '0xa9059cbb',
        to: PROJECT_CONTRACTS.zkAddress as Hex,
      });

      if (currentBalance < amountInt) {
        const transferred = amountInt - currentBalance;

        const transferGasSpent = moralis.getSpentGas(transferredTxData);

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

    const claimData = await moralis.getTx({
      txHash,
      chainId: client.chainData.id,
    });

    const claimGasSpent = moralis.getSpentGas(claimData);

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
