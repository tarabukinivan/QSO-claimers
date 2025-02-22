import { Hex } from 'viem';

import settings from '../../../../_inputs/settings/settings';
import { CLAIM_STATUSES, DB_NOT_CONNECTED } from '../../../../constants';
import {
  decimalToInt,
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  sleepByRange,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { TransformedModuleParams } from '../../../../types';
import { ScrollClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { CLAIM_SCROLL_CONTRACT, HEADERS, SCROLL_ABI, SCROLL_TOKEN_CONTRACT } from './constants';
import { getBalance, getProofData } from './helpers';

export const execMakeClaimScroll = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make claim SCR...',
    transactionCallback: makeClaimScroll,
  });

const makeClaimScroll = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, logger, dbSource, gweiRange, gasLimitRange, wallet, network, proxyAgent } = params;

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

  const dbRepo = dbSource.getRepository(ScrollClaimEntity);

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

  const created = dbRepo.create({
    walletId: wallet.id,
    index: wallet.index,
    walletAddress,
    network,
    nativeBalance,
    status: 'New',
    // TODO: add marks
    marks: '',
  });
  walletInDb = await dbRepo.save(created);

  try {
    const contract = CLAIM_SCROLL_CONTRACT;

    const { int } = await client.getNativeBalance();
    nativeBalance = +int.toFixed(6);

    const proofRes = await getProofData(dataProps);
    if (!proofRes?.amount || !proofRes?.proof) {
      await dbRepo.update(walletInDb.id, {
        status: CLAIM_STATUSES.NOT_ELIGIBLE,
      });

      return {
        status: 'passed',
        message: getCheckClaimMessage(CLAIM_STATUSES.NOT_ELIGIBLE),
      };
    }

    const amountWei = BigInt(proofRes.amount);
    amountInt = decimalToInt({
      amount: amountWei,
    });

    const { currentBalance: currentBalanceInt } = await getBalance(client);
    currentBalance = currentBalanceInt;

    const claimed = (await publicClient.readContract({
      address: CLAIM_SCROLL_CONTRACT,
      abi: SCROLL_ABI,
      functionName: 'hasClaimed',
      args: [walletAddress],
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
        status: CLAIM_STATUSES.CLAIMED_NOT_SENT,
        claimAmount: amountInt,
        nativeBalance,
        balance: currentBalance,
      });

      const status = getCheckClaimMessage(CLAIM_STATUSES.CLAIMED_NOT_SENT);

      return {
        status: 'success',
        message: status,
        tgMessage: `${status} | Amount: ${amountInt}`,
      };
    }

    const feeOptions = await getGasOptions({
      gweiRange,
      gasLimitRange,
      network,
      publicClient,
    });

    const delegates = (await publicClient.readContract({
      address: SCROLL_TOKEN_CONTRACT,
      abi: SCROLL_ABI,
      functionName: 'delegates',
      args: [walletAddress],
    })) as any[];

    if (!delegates?.length) {
      const delegateTxHash = await walletClient.writeContract({
        address: SCROLL_TOKEN_CONTRACT,
        abi: SCROLL_ABI,
        // TODO: HERE
        functionName: 'delegate',
        args: [[{ _delegatee: walletAddress as Hex, _numerator: 10000n }]],
        // TODO: ?
        // value: amountWei,
        ...feeOptions,
      });

      await client.waitTxReceipt(delegateTxHash);

      logger.success(`Check delegate tx: ${explorerLink}/tx/${delegateTxHash}`);

      await sleepByRange(settings.delay.betweenTransactions, {}, logger);
    }

    const txHash = await walletClient.writeContract({
      address: contract,
      abi: SCROLL_ABI,
      // TODO: HERE
      functionName: 'claim',
      args: [walletAddress, amountWei, proofRes.proof],
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
      tgMessage: `Claimed ${amountInt} SCR`,
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
