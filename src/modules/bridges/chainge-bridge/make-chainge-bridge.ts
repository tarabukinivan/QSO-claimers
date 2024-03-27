import { TransactionCallbackParams, TransactionCallbackReturn, transactionWorker } from '../../../helpers';
import { TransformedModuleParams } from '../../../types';

export const execMakeChaingeBridge = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make chainge bridge...',
    transactionCallback: makeChaingeBridge,
  });

export const makeChaingeBridge = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client } = params;

  return {
    status: 'error',
  };
};
