import uniq from 'lodash/uniq';

import {
  getTrimmedLogsAmount,
  sleep,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../helpers';
import { Bitget } from '../../managers/bitget';
import { TransformedModuleParams } from '../../types';

export const execMakeBitgetWaitBalance = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make waiting balance on Bitget...',
    transactionCallback: makeBitgetWaitBalance,
  });

export const makeBitgetWaitBalance = async (
  params: TransactionCallbackParams & {
    hideExtraLogs?: boolean;
  }
): TransactionCallbackReturn => {
  const { client, hideExtraLogs, waitTime, waitBalance, network, logger, collectTokens } = params;

  const uniqueCollectTokens = uniq(collectTokens);

  const bitget = new Bitget({
    network,
    client,
    logger,
    hideExtraLogs,
  });

  const resBalances: string[] = [];
  let balanceIsOkay = false;
  while (!balanceIsOkay) {
    await bitget.makeTransferFromSubsToMain({
      tokens: uniqueCollectTokens,
    });

    const currentBalancesOkay: string[] = [];
    for (const token of uniqueCollectTokens) {
      const currentTokenBalance = await bitget.getTokenBalance(token);

      if (currentTokenBalance < waitBalance) {
        logger.warning(
          `Balance of [${getTrimmedLogsAmount(currentTokenBalance, token)}] is lower than waitBalance [${waitBalance}]`
        );
        balanceIsOkay = false;
      } else {
        currentBalancesOkay.push(getTrimmedLogsAmount(currentTokenBalance, token));
        balanceIsOkay = true;
      }
    }

    if (!balanceIsOkay) {
      await sleep(waitTime || 60);
    } else {
      resBalances.push(...currentBalancesOkay);
    }
  }

  const resMsg = `Bitget balances: ${resBalances.join(' | ')}`;

  return {
    status: 'success',
    message: resMsg,
    tgMessage: resMsg,
  };
};
