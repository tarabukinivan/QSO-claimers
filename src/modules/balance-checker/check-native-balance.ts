import { TransactionCallbackParams, TransactionCallbackReturn, transactionWorker } from '../../helpers';
import { TransformedModuleParams } from '../../types';

export const execCheckNativeBalance = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: `Execute check native balance of ${params.network}...`,
    transactionCallback: makeCheckBalance,
  });

const makeCheckBalance = async (props: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client, network, minNativeBalance } = props;

  const { int: nativeBalance } = await client.getNativeBalance();

  // TODO: make not only for native balance
  if (nativeBalance >= minNativeBalance && minNativeBalance !== 0) {
    const message = `Native balance ${nativeBalance.toFixed(
      4
    )} of ${network} already more than or equals ${minNativeBalance}`;
    return {
      status: 'passed',
      message,
    };
  }

  const message = `Native balance ${nativeBalance.toFixed(5)} of ${network} less than ${minNativeBalance}`;

  return {
    status: 'success',
    message,
  };
};
