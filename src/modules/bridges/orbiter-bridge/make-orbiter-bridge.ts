import {
  calculateAmount,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../helpers';
import { TransformedModuleParams } from '../../../types';
import { MAX_AMOUNT_TO_BRIDGE, MIN_AMOUNT_TO_BRIDGE, ORBITER_BRIDGE_CONTRACT, TRADING_FEE } from './constants';
import { getOrbiterValue } from './helpers';

export const execOrbiterBridge = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make orbiter bridge...',
    transactionCallback: makeOrbiterBridge,
  });

export const makeOrbiterBridge = async ({
  client,
  minAndMaxAmount,
  usePercentBalance,
  destinationNetwork,
}: TransactionCallbackParams): TransactionCallbackReturn => {
  const { int: balance } = await client.getNativeBalance();

  const amount = calculateAmount({
    balance,
    minAndMaxAmount,
    usePercentBalance,
  });

  const minAmountToMakeBridge = MIN_AMOUNT_TO_BRIDGE + TRADING_FEE;

  if (balance < amount || amount < minAmountToMakeBridge) {
    return {
      status: 'error',
      message: 'Insufficient balance for bridge',
    };
  }

  if (amount > MAX_AMOUNT_TO_BRIDGE) {
    return {
      status: 'error',
      message: `You provided more than the [${MAX_AMOUNT_TO_BRIDGE}] maximum number of tokens for bridge`,
    };
  }

  const value = getOrbiterValue(amount, destinationNetwork);

  const request = await client.walletClient.prepareTransactionRequest({
    account: client.walletClient.account,
    to: ORBITER_BRIDGE_CONTRACT,
    value,
  });

  const signature = await client.walletClient.signTransaction(request);
  const txHash = await client.walletClient.sendRawTransaction({ serializedTransaction: signature });

  return {
    status: 'success',
    explorerLink: client.explorerLink,
    txHash,
  };
};
