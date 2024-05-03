import { fromHex } from 'viem';

import { CLAIM_STATUSES, DB_NOT_CONNECTED } from '../../../../constants';
import {
  decimalToInt,
  getAxiosConfig,
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
import { CONTRACT_MAP, DECIMALS } from './constants';
import { getBalance, getProofData, getTransactionsData } from './helpers';

export const execMakeCheckClaimPolyhedra = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make check claim ZK...',
    transactionCallback: makeCheckClaimPolyhedra,
  });

const makeCheckClaimPolyhedra = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, dbSource, network, wallet, proxyAgent } = params;

  const { walletAddress } = client;

  if (!dbSource) {
    return {
      status: 'critical',
      message: DB_NOT_CONNECTED,
    };
  }

  let nativeBalance = 0;

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

  const headers = getHeaders();
  const config = await getAxiosConfig({
    proxyAgent,
    headers,
  });

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

    const getDataProps = {
      network,
      config,
      walletAddress,
      chainId: client.chainData.id,
    };
    const proofData = await getProofData(getDataProps);

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
    const amountInt = decimalToInt({
      amount: amountWei,
      decimals: DECIMALS,
    });

    const txsData = await getTransactionsData(getDataProps);

    // TODO: move it to the separate helper/manager
    const claimTxData = txsData?.find(
      ({
        method,
        to,
        input,
        to_address, // TODO: move this type to the interface
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

    const currentBalance = await getBalance(client);

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

    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.NOT_CLAIMED,
      claimAmount: amountInt,
      balance: currentBalance,
    });

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
