import { TransactionCallbackParams, TransactionCallbackReturn, transactionWorker } from '../../../helpers';
import { TransformedModuleParams } from '../../../types';

export const execMakeRhinoBridge = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make rhino bridge...',
    transactionCallback: makeRhinoBridge,
  });

export const makeRhinoBridge = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const { client } = params;

  return {
    status: 'error',
  };
};
