import { EMPTY_BALANCE_ERROR, OKX_WL_ERROR, WAIT_TOKENS } from '../../constants';
import {
  addNumberPercentage,
  getClientByNetwork,
  getExpectedBalance,
  getLogMsgWalletToppedUp,
  getRandomNetwork,
  getTopUpOptions,
  GetTopUpOptionsResult,
  sleep,
  TransactionCallbackParams,
  TransactionCallbackResponse,
  TransactionCallbackReturn,
  transactionWorker,
  getContractData,
  getTrimmedLogsAmount,
} from '../../helpers';
import { type LoggerData } from '../../logger';
import { Okx } from '../../managers/okx';
import { OkxNetworks, Tokens, TransformedModuleParams } from '../../types';
import { okxWaitBalance } from '../okx-collect';

interface MakeOkxWithdraw {
  preparedTopUpOptions?: GetTopUpOptionsResult;
  hideExtraLogs?: boolean;
  withMinAmountError?: boolean;
}
export const makeOkxWithdraw = async (
  props: TransactionCallbackParams & MakeOkxWithdraw
): TransactionCallbackReturn => {
  const logTemplate: LoggerData = {
    action: 'execWithdraw',
  };

  const {
    okxWithdrawNetwork: okxWithdrawNetworkProp,
    wallet,
    expectedBalance,
    logger,
    minTokenBalance,
    minAndMaxAmount,
    tokenToWithdraw: tokenToWithdrawProp,
    randomOkxWithdrawNetworks,
    amount,
    minAmount,
    waitTime,
    hideExtraLogs = false,
    useUsd = false,
    nativePrices,
    preparedTopUpOptions,
    withdrawAdditionalPercent,
    withMinAmountError,
    minDestTokenBalance,
    minDestTokenNetwork,
    waitBalance,
    collectTokens,
  } = props;

  if (minDestTokenBalance) {
    const destClient = getClientByNetwork(minDestTokenNetwork, wallet.privKey, logger);
    const nativeToken = destClient.chainData.nativeCurrency.symbol as Tokens;
    const tokenToCheck = tokenToWithdrawProp || nativeToken;

    const {
      tokenContractInfo,
      isNativeToken: isNativeTokenToWithdraw,
      token,
    } = getContractData({
      nativeToken,
      network: minDestTokenNetwork,
      token: tokenToCheck,
    });

    const balance = await destClient.getNativeOrContractBalance(isNativeTokenToWithdraw, tokenContractInfo);
    if (balance.int >= minDestTokenBalance) {
      return {
        status: 'passed',
        message: `Balance [${getTrimmedLogsAmount(
          balance.int,
          token
        )}] in ${minDestTokenNetwork} is already equal or more then minDestTokenBalance [${minDestTokenBalance} ${token}]`,
      };
    }
  }

  if (waitBalance && collectTokens?.length) {
    const { message } = await okxWaitBalance(props);
    if (message) {
      logger.success(message);
    }
  }

  let okxWithdrawNetwork = okxWithdrawNetworkProp;
  let client = getClientByNetwork(okxWithdrawNetwork, wallet.privKey, logger);
  const nativeToken = client.chainData.nativeCurrency.symbol as Tokens;

  let {
    tokenContractInfo,
    isNativeToken: isNativeTokenToWithdraw,
    token: tokenToWithdraw,
  } = getContractData({
    nativeToken,
    network: okxWithdrawNetwork,
    token: tokenToWithdrawProp,
  });

  if (randomOkxWithdrawNetworks?.length) {
    const res = await getRandomNetwork({
      wallet,
      randomNetworks: randomOkxWithdrawNetworks,
      logger,
      minTokenBalance,
      useUsd,
      nativePrices,
      client,
      tokenContractInfo,
      network: okxWithdrawNetwork,
      token: tokenToWithdraw,
      isNativeToken: isNativeTokenToWithdraw,
    });

    if ('status' in res) {
      return res as TransactionCallbackResponse;
    }

    client = res.client;
    okxWithdrawNetwork = res.network as OkxNetworks;
    tokenContractInfo = res.tokenContractInfo;
    isNativeTokenToWithdraw = res.isNativeToken;
    tokenToWithdraw = res.token;
  }

  const { currentExpectedBalance, isTopUpByExpectedBalance } = getExpectedBalance(expectedBalance);

  const walletAddress = wallet.walletAddress;

  const topUpOptions =
    preparedTopUpOptions ||
    (await getTopUpOptions({
      client,
      wallet,
      logger,
      nativePrices,
      currentExpectedBalance,
      isTopUpByExpectedBalance,
      minTokenBalance,
      minAndMaxAmount,
      isNativeTokenToWithdraw,
      tokenContractInfo,
      tokenToWithdraw,
      amount,
      network: okxWithdrawNetwork,
      useUsd,
      minAmount,
      withMinAmountError,
    }));

  const isDone = 'isDone' in topUpOptions;
  if (isDone) {
    return {
      status: 'passed',
      message: topUpOptions.successMessage,
    };
  }

  const { currentAmount, currentMinAmount, shouldTopUp, prevTokenBalance } = topUpOptions;

  const okx = new Okx({
    logger,
    amount: withdrawAdditionalPercent ? addNumberPercentage(currentAmount, withdrawAdditionalPercent) : currentAmount,
  });

  if (shouldTopUp) {
    try {
      const { id, logsAmount } = await okx.execWithdraw({
        walletAddress,
        token: tokenToWithdraw,
        network: okxWithdrawNetwork,
        minAmount: currentMinAmount,
      });

      let currentBalance = await client.getNativeOrContractBalance(isNativeTokenToWithdraw, tokenContractInfo);

      // let withdrawIsOk = await okx.checkWithdrawal({ id, publicClient: client.publicClient });
      while (
        !(currentBalance.int > prevTokenBalance)
        // && withdrawIsOk
      ) {
        try {
          const currentSleep = waitTime || 20;
          await sleep(currentSleep);

          currentBalance = await client.getNativeOrContractBalance(isNativeTokenToWithdraw, tokenContractInfo);
          // withdrawIsOk = await okx.checkWithdrawal({ id, publicClient: client.publicClient });

          if (!hideExtraLogs) {
            logger.info(WAIT_TOKENS, logTemplate);
          }
        } catch (e) {
          //
        }
      }

      // if (!withdrawIsOk) {
      //   return {
      //     status: 'error',
      //     message: 'Unable to make withdraw successfully',
      //   };
      // }

      const message = getLogMsgWalletToppedUp({
        cex: 'OKX',
        balance: currentBalance.int,
        token: tokenToWithdraw,
      });
      return {
        status: 'success',
        message,
        tgMessage: `${okxWithdrawNetwork} | Withdrawn: ${logsAmount}`,
      };
    } catch (err) {
      const errorMessage = (err as Error).message;

      if (errorMessage.includes(OKX_WL_ERROR)) {
        throw new Error(OKX_WL_ERROR);
      }

      if (errorMessage.includes(EMPTY_BALANCE_ERROR)) {
        return {
          status: 'error',
          message: `OKX balance in ${okxWithdrawNetwork} is low to make withdrawal`,
        };
      }

      throw err;
    }
  }

  return {
    status: 'error',
  };
};

export const execOkxWithdraw = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make OKX withdraw...',
    transactionCallback: makeOkxWithdraw,
  });
