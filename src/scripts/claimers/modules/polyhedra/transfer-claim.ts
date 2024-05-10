import { Hex } from 'viem';

import { defaultTokenAbi } from '../../../../clients/abi';
import {
  DB_NOT_CONNECTED,
  SECOND_ADDRESS_EMPTY_ERROR,
  CLAIM_STATUSES,
  ZERO_TRANSFER_AMOUNT,
  CLAIM_TX_NOT_FOUND,
} from '../../../../constants';
import {
  calculateAmount,
  getAxiosConfig,
  getGasOptions,
  getHeaders,
  intToDecimal,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../../helpers';
import { Moralis } from '../../../../managers/moralis';
import { TransformedModuleParams } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';
import { PolyhedraClaimEntity } from '../../db/entities';
import { formatErrMessage, getCheckClaimMessage } from '../../utils';
import { CONTRACT_MAP, DECIMALS } from './constants';
import { getBalance } from './helpers';

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
    logger,
  } = params;

  const { walletClient, walletAddress, publicClient, explorerLink } = client;

  const moralis = new Moralis();

  let nativeBalance = 0;
  let claimGasSpent = 0;
  let currentBalance = 0;

  if (!dbSource) {
    return {
      status: 'critical',
      message: DB_NOT_CONNECTED,
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

    const amountToTransfer = calculateAmount({
      balance: currentBalance,
      minAndMaxAmount,
      usePercentBalance,
    });

    const txsData = await moralis.getTxs({
      walletAddress,
      chainId: client.chainData.id,
    });

    const claimTxData = moralis.getTxData({
      txs: txsData,
      method: '0x2e7ba6ef',
      to: contract,
    });

    if (!claimTxData) {
      throw new Error(CLAIM_TX_NOT_FOUND);
    }

    const transferredTxData = moralis.getTxData({
      txs: txsData,
      method: '0xa9059cbb',
      to: PROJECT_CONTRACTS.zkAddress as Hex,
    });

    const isEmptyAmount = amountToTransfer === 0;
    if (transferredTxData && isEmptyAmount) {
      const transferGasSpent = moralis.getSpentGas(transferredTxData);

      await dbRepo.update(walletInDb.id, {
        status: CLAIM_STATUSES.TRANSFER_SUCCESS,
        balance: currentBalance - amountToTransfer,
        gasSpent: +(claimGasSpent + transferGasSpent).toFixed(6),
        nativeBalance,
      });

      return {
        status: 'success',
        message: getCheckClaimMessage(CLAIM_STATUSES.CLAIMED_AND_SENT),
      };
    }

    if (!transferredTxData && isEmptyAmount) {
      throw new Error(ZERO_TRANSFER_AMOUNT);
    }

    claimGasSpent = moralis.getSpentGas(claimTxData);

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

    const transferData = await moralis.getTx({
      txHash,
      chainId: client.chainData.id,
    });

    const transferGasSpent = moralis.getSpentGas(transferData);

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
    const errMessage = formatErrMessage(err);
    await dbRepo.update(walletInDb.id, {
      status: CLAIM_STATUSES.TRANSFER_ERROR,
      balance: currentBalance,
      nativeBalance,
      gasSpent: +claimGasSpent.toFixed(6),
      error: errMessage,
    });

    if (errMessage === CLAIM_TX_NOT_FOUND || errMessage === ZERO_TRANSFER_AMOUNT) {
      return {
        status: 'warning',
        message: errMessage,
      };
    }

    throw err;
  }
};
