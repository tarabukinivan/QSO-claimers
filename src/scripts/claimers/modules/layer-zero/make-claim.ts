import { CLAIM_STATUSES, DB_NOT_CONNECTED } from '../../../../constants';
import {
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  getTrimmedLogsAmount,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { TransformedModuleParams } from '../../../../types';
import { PolyhedraClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { HEADERS, ZRO_ABI, ZRO_CLAIM_CONTRACTS, ZRO_CLAIMER_CONTRACTS } from './constants';
import { getAmount, getBalance, getDonationData, getEligibilityData, getProofData } from './helpers';

export const execMakeClaimLayerZero = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make claim $ZRO...',
    transactionCallback: makeClaimLayerZero,
  });

const makeClaimLayerZero = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
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

    const proofRes = await getProofData(dataProps);
    const proofs = proofRes.proof.split('|');

    const { amountInt: amountIntRes, amountWei } = await getAmount(eligibilityRes);
    amountInt = amountIntRes;

    const claimed = (await publicClient.readContract({
      address: zroClaimedContract,
      abi: ZRO_ABI,
      functionName: 'zroClaimed',
      args: [walletAddress],
    })) as bigint;

    if (claimed > 0n) {
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

    const { donationBalanceInt, donationAmountWei, donationAmountInt } = await getDonationData({
      client,
      network,
      amountInt,
      nativePrices,
      tokenToSupply,
    });

    if (donationBalanceInt < donationAmountInt) {
      const errMessage = `Balance [${getTrimmedLogsAmount(
        +donationBalanceInt,
        tokenToSupply
      )}] is not enough to pay minimal donation [${getTrimmedLogsAmount(+donationAmountInt, tokenToSupply)}]`;
      await dbRepo.update(walletInDb.id, {
        status: CLAIM_STATUSES.CLAIM_ERROR,
        claimAmount: amountInt,
        nativeBalance,
        balance: currentBalance,
        error: errMessage,
      });

      return {
        status: 'error',
        message: errMessage,
      };
    }

    currentBalance = await getBalance(client);

    const feeOptions = await getGasOptions({
      gweiRange,
      gasLimitRange,
      network,
      publicClient,
    });

    const txHash = await walletClient.writeContract({
      address: contract,
      abi: ZRO_ABI,
      functionName: 'donateAndClaim',
      args: [2, donationAmountWei, amountWei, proofs, walletAddress, '0x'],
      value: donationAmountWei,
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
      tgMessage: `Claimed ${amountInt} $ZRO`,
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
