import { Hex } from 'viem';

import { MORALIS_KEY } from '../../../../_inputs/settings';
import { defaultTokenAbi } from '../../../../clients/abi';
import { DB_NOT_CONNECTED, SECOND_ADDRESS_EMPTY_ERROR, CLAIM_STATUSES, EMPTY_MORALIS_KEY } from '../../../../constants';
import {
  calculateAmount,
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  getSpentGas,
  intToDecimal,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import logger from '../../../../logger';
import { TransformedModuleParams } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';
import { PolyhedraClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { CONTRACT_MAP, DECIMALS } from './constants';
import { getBalance, getTransactionData, getTransactionsData } from './helpers';

export const execMakeTransferClaimPolyhedra = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make transfer claimed ZK...',
    transactionCallback: makeTransferClaimPolyhedra,
  });

const makeTransferClaimPolyhedra = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const {
    client,
    dbSource,
    proxyAgent,
    minAndMaxAmount,
    usePercentBalance,
    wallet,
    gweiRange,
    gasLimitRange,
    network,
  } = params;

  const { walletClient, walletAddress, publicClient, explorerLink } = client;

  let nativeBalance = 0;
  let claimGasSpent = 0;
  let currentBalance = 0;

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

    const secondAddress = wallet.secondAddress;
    if (!secondAddress) {
      throw new Error(SECOND_ADDRESS_EMPTY_ERROR);
    }

    const feeOptions = await getGasOptions({
      gweiRange,
      gasLimitRange,
      network,
      publicClient,
    });

    currentBalance = await getBalance(client);

    const txsData = await getTransactionsData({
      config,
      walletAddress,
      network,
      chainId: client.chainData.id,
    });

    const amountToTransfer = calculateAmount({
      balance: currentBalance,
      minAndMaxAmount,
      usePercentBalance,
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

    if (!claimTxData) {
      throw new Error('Claim was not found');
    }

    if (amountToTransfer === 0) {
      throw new Error('Amount is zero');
    }

    claimGasSpent = getSpentGas(claimTxData.gas_price, claimTxData.gas_used);

    logger.info(`Sending ${amountToTransfer} ZK to ${secondAddress}...`);

    const txHash = await walletClient.writeContract({
      address: PROJECT_CONTRACTS.zkAddress as Hex,
      abi: defaultTokenAbi,
      functionName: 'transfer',
      args: [
        secondAddress as Hex,
        intToDecimal({
          amount: amountToTransfer,
          decimals: DECIMALS,
        }),
      ],
      ...feeOptions,
    });

    await client.waitTxReceipt(txHash);

    const transferData = await getTransactionData({
      config,
      txHash,
      chainId: client.chainData.id,
      network,
    });
    const transferGasSpent = transferData ? getSpentGas(transferData.gas_price, transferData.gas_used) : 0;

    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.TRANSFER_SUCCESS,
      balance: currentBalance - amountToTransfer,
      gasSpent: +(claimGasSpent + transferGasSpent).toFixed(6),
      nativeBalance,
      transferred: amountToTransfer,
      transferredTo: secondAddress,
    });

    return {
      status: 'success',
      txHash,
      explorerLink,
      message: getCheckClaimMessage(CLAIM_STATUSES.TRANSFER_SUCCESS),
    };
  } catch (err) {
    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.TRANSFER_ERROR,
      balance: currentBalance,
      nativeBalance,
      gasSpent: +claimGasSpent.toFixed(6),
      error: formatErrMessage(err),
    });

    throw err;
  }
};
