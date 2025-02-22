import { CLAIM_STATUSES, DB_NOT_CONNECTED } from '../../../../constants';
import {
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  intToDecimal,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { TransformedModuleParams } from '../../../../types';
import { TaikoClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { CLAIM_TAIKO_CONTRACT, HEADERS, TAIKO_ABI } from './constants';
import { getBalance, getFinalData, getProofData } from './helpers';

export const execMakeClaimTaiko = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make claim TAIKO...',
    transactionCallback: makeClaimTaiko,
  });

const makeClaimTaiko = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, nativePrices, tokenToSupply, dbSource, gweiRange, gasLimitRange, wallet, network, proxyAgent } =
    params;

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

  const dbRepo = dbSource.getRepository(TaikoClaimEntity);

  let walletInDb = await dbRepo.findOne({
    where: {
      walletId: wallet.id,
      index: wallet.index,
    },
  });
  if (walletInDb) {
    await dbRepo.remove(walletInDb);
  }

  const headers = getHeaders(HEADERS);
  const config = await getAxiosConfig({
    proxyAgent,
    headers,
  });
  const dataProps = {
    network,
    config,
    walletAddress,
    chainId: client.chainData.id,
  };

  const finalRes = await getFinalData(dataProps);

  const created = dbRepo.create({
    walletId: wallet.id,
    index: wallet.index,
    walletAddress,
    network,
    nativeBalance,
    status: 'New',
    score: finalRes.total,
  });
  walletInDb = await dbRepo.save(created);

  try {
    const contract = CLAIM_TAIKO_CONTRACT;

    const { int } = await client.getNativeBalance();
    nativeBalance = +int.toFixed(6);

    const proofRes = await getProofData(dataProps);
    if (!proofRes.value || !proofRes.proof) {
      await dbRepo.update(walletInDb.id, {
        status: CLAIM_STATUSES.NOT_ELIGIBLE,
      });

      return {
        status: 'passed',
        message: getCheckClaimMessage(CLAIM_STATUSES.NOT_ELIGIBLE),
      };
    }

    amountInt = +proofRes.value;
    const amountWei = intToDecimal({
      amount: amountInt,
      decimals: 18,
    });

    const { currentBalance: currentBalanceInt } = await getBalance(client);
    currentBalance = currentBalanceInt;

    const claimed = (await publicClient.readContract({
      address: contract,
      abi: TAIKO_ABI,
      functionName: 'hasClaimed',
      args: [walletAddress, amountWei],
    })) as bigint;

    if (claimed > 0n) {
      if (currentBalance === 0) {
        await dbRepo.update(walletInDb.id, {
          status: CLAIM_STATUSES.CLAIMED_AND_SENT,
          claimAmount: amountInt,
          nativeBalance,
          balance: currentBalance,
        });

        return {
          status: 'passed',
          message: getCheckClaimMessage(CLAIM_STATUSES.CLAIMED_AND_SENT),
        };
      }

      await dbRepo.update(walletInDb.id, {
        status: CLAIM_STATUSES.ALREADY_CLAIMED,
        claimAmount: amountInt,
        nativeBalance,
        balance: currentBalance,
      });

      return {
        status: 'passed',
        message: getCheckClaimMessage(CLAIM_STATUSES.ALREADY_CLAIMED),
      };
    }

    const feeOptions = await getGasOptions({
      gweiRange,
      gasLimitRange,
      network,
      publicClient,
    });

    const proof = JSON.parse(proofRes.proof);
    const txHash = await walletClient.writeContract({
      address: contract,
      abi: TAIKO_ABI,
      functionName: 'claim',
      args: [walletAddress, amountWei, proof],
      // TODO: ?
      // value: amountWei,
      ...feeOptions,
    });

    await client.waitTxReceipt(txHash);

    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.CLAIM_SUCCESS,
      claimAmount: amountInt,
      nativeBalance,
      balance: currentBalance + amountInt,
    });

    return {
      tgMessage: `Claimed ${amountInt} TAIKO`,
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
