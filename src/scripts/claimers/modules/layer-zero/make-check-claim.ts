import { CLAIM_STATUSES, DB_NOT_CONNECTED } from '../../../../constants';
import {
  decimalToInt,
  getAxiosConfig,
  getHeaders,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { TransformedModuleParams } from '../../../../types';
import { PolyhedraClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { HEADERS, ZRO_ABI, ZRO_CLAIM_CONTRACTS, ZRO_CLAIMER_CONTRACTS } from './constants';
import { getBalance, getEligibilityData } from './helpers';

export const execMakeCheckClaimLayerZero = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make check claim $ZRO...',
    transactionCallback: makeCheckClaimLayerZero,
  });

const makeCheckClaimLayerZero = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, dbSource, network, wallet, proxyAgent } = params;

  const { walletAddress, publicClient } = client;

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
    const zroClaimedContract = ZRO_CLAIMER_CONTRACTS[network];
    const contract = ZRO_CLAIM_CONTRACTS[network];
    if (!contract || !zroClaimedContract) {
      throw new Error(`Network ${network} is not supported`);
    }

    const headers = getHeaders(HEADERS);
    const config = await getAxiosConfig({
      proxyAgent,
      headers,
    });

    const { int } = await client.getNativeBalance();
    nativeBalance = +int.toFixed(6);

    const dataProps = {
      network,
      config,
      walletAddress,
      chainId: client.chainData.id,
    };

    const eligibilityRes = await getEligibilityData(dataProps);
    if (!eligibilityRes.isEligible) {
      await dbRepo.update(walletInDb.id, {
        status: CLAIM_STATUSES.NOT_ELIGIBLE,
      });

      return {
        status: 'passed',
        message: getCheckClaimMessage(CLAIM_STATUSES.NOT_ELIGIBLE),
      };
    }

    const amountWei = BigInt(eligibilityRes.zroAllocation.asBigInt);
    amountInt = decimalToInt({
      amount: amountWei,
      decimals: eligibilityRes.zroAllocation.decimals,
    });

    const { currentBalance: currentBalanceInt } = await getBalance(client);
    currentBalance = currentBalanceInt;

    const claimed = (await publicClient.readContract({
      address: zroClaimedContract,
      abi: ZRO_ABI,
      functionName: 'zroClaimed',
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

      return {
        status: 'success',
        message: getCheckClaimMessage(CLAIM_STATUSES.CLAIMED_NOT_SENT),
      };
    }

    return {
      status: 'success',
      message: getCheckClaimMessage(CLAIM_STATUSES.NOT_CLAIMED),
    };
  } catch (err) {
    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.CHECK_ERROR,
      nativeBalance,
      error: formatErrMessage(err),
    });

    throw err;
  }
};
