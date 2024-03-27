import { defaultTokenAbi } from '../../clients/abi';
import { EMPTY_BALANCE_ERROR, OKX_WL_ERROR } from '../../constants';
import {
  addNumberPercentage,
  CryptoCompareResult,
  getClientByNetwork,
  getExpectedBalance,
  getRandomNumber,
  getTokenContract,
  getTopUpOptions,
  GetTopUpOptionsResult,
  sleep,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../helpers';
import { type LoggerData, LoggerType } from '../../logger';
import { Okx } from '../../managers/okx';
import { NumberRange, OkxNetworks, Tokens, TransformedModuleParams, WalletData } from '../../types';

export const executeOkxWithdraw = async (params: TransactionCallbackParams) => {
  const {
    wallet,
    okxWithdrawNetwork,
    tokenToWithdraw,
    minAndMaxAmount,
    minTokenBalance,
    logger,
    expectedBalance,
    amount,
    minAmount,
    useUsd,
    randomOkxWithdrawNetworks,
    nativePrices,
    withdrawAdditionalPercent,
  } = params;

  return makeOkxWithdraw({
    wallet,
    okxWithdrawNetwork,
    tokenToWithdraw,
    minAndMaxAmount,
    minTokenBalance,
    logger,
    expectedBalance,
    amount,
    minAmount,
    useUsd,
    randomOkxWithdrawNetworks,
    nativePrices,
    withdrawAdditionalPercent,
  });
};

interface MakeOkxWithdraw {
  okxWithdrawNetwork: OkxNetworks;
  wallet: WalletData;
  logger: LoggerType;
  minAndMaxAmount: NumberRange;
  tokenToWithdraw?: Tokens;
  nativePrices: CryptoCompareResult;
  useUsd?: boolean;
  randomOkxWithdrawNetworks?: OkxNetworks[];
  amount?: number;
  percentToAdd?: number;
  minTokenBalance?: number;
  fee?: number;
  minAmount?: number;
  expectedBalance?: NumberRange;
  withdrawSleep?: NumberRange;
  hideExtraLogs?: boolean;
  preparedTopUpOptions?: GetTopUpOptionsResult;
  withdrawAdditionalPercent?: number;
  withMinAmountError?: boolean;
}
export const makeOkxWithdraw = async (props: MakeOkxWithdraw): TransactionCallbackReturn => {
  const logTemplate: LoggerData = {
    action: 'execWithdraw',
    status: 'in progress',
  };

  const {
    okxWithdrawNetwork: okxWithdrawNetworkProp,
    wallet,
    expectedBalance,
    logger,
    minTokenBalance,
    minAndMaxAmount,
    tokenToWithdraw: tokenToWithdrawProp,
    amount,
    minAmount,
    withdrawSleep,
    hideExtraLogs = false,
    useUsd = false,
    nativePrices,
    preparedTopUpOptions,
    withdrawAdditionalPercent,
    withMinAmountError,
  } = props;

  const okxWithdrawNetwork = okxWithdrawNetworkProp;

  const { currentExpectedBalance, isTopUpByExpectedBalance } = getExpectedBalance(expectedBalance);

  const client = getClientByNetwork(okxWithdrawNetwork, wallet.privKey, logger);
  const nativeToken = client.chainData.nativeCurrency.symbol as Tokens;
  const tokenToWithdraw = tokenToWithdrawProp || nativeToken;
  const isNativeTokenToWithdraw = tokenToWithdraw === nativeToken;

  let tokenContractInfo;
  if (!isNativeTokenToWithdraw) {
    const tokenContract = getTokenContract({
      tokenName: tokenToWithdraw,
      network: okxWithdrawNetwork,
    });

    tokenContractInfo = isNativeTokenToWithdraw
      ? undefined
      : {
          name: tokenToWithdraw,
          address: tokenContract.address,
          abi: defaultTokenAbi,
        };
  }

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
      const id = await okx.execWithdraw({
        walletAddress,
        token: tokenToWithdraw,
        network: okxWithdrawNetwork,
        minAmount: currentMinAmount,
      });

      let currentBalance = await client.getNativeOrContractBalance(isNativeTokenToWithdraw, tokenContractInfo);

      let withdrawIsOk = await okx.checkWithdrawal({ id, publicClient: client.publicClient });
      while (!(currentBalance.int > prevTokenBalance) && withdrawIsOk) {
        const currentSleep = withdrawSleep ? getRandomNumber(withdrawSleep) : 20;
        await sleep(currentSleep);
        currentBalance = await client.getNativeOrContractBalance(isNativeTokenToWithdraw, tokenContractInfo);
        withdrawIsOk = await okx.checkWithdrawal({ id, publicClient: client.publicClient });

        if (!hideExtraLogs) {
          logger.info('Tokens are still on the way to wallet...', logTemplate);
        }
      }

      if (!withdrawIsOk) {
        return {
          status: 'error',
          message: 'Unable to make withdraw successfully',
        };
      }

      return {
        status: 'success',
        message: `Your wallet was successfully topped up from OKX. Current balance is [${currentBalance.int.toFixed(
          6
        )} ${tokenToWithdraw}]`,
      };
    } catch (err) {
      const errorMessage = (err as Error).message;

      if (errorMessage.includes(OKX_WL_ERROR)) {
        throw new Error(OKX_WL_ERROR);
      }

      if (errorMessage.includes(EMPTY_BALANCE_ERROR)) {
        return {
          status: 'critical',
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
    transactionCallback: executeOkxWithdraw,
  });
