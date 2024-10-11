import { Hex } from 'viem';

import { BITGET_ADDRESS_EMPTY_ERROR } from '../../constants';
import {
  getContractData,
  getGasOptions,
  getRandomNetwork,
  TransactionCallbackParams,
  TransactionCallbackResponse,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../helpers';
import { Bitget } from '../../managers/bitget';
import { Tokens, TransformedModuleParams } from '../../types';

export const execMakeBitgetDeposit = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make deposit to Bitget...',
    transactionCallback: makeBitgetDeposit,
  });

const makeBitgetDeposit = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const {
    client,
    network,
    logger,
    minAmount,
    usePercentBalance,
    minAndMaxAmount,
    tokenToSupply,
    wallet,
    gasLimitRange,
    gweiRange,
    minTokenBalance,
    balanceToLeft,
    randomNetworks,
    useUsd,
    nativePrices,
  } = params;

  const toAddress = wallet.bitgetAddress as Hex | undefined;
  if (!toAddress) {
    return {
      status: 'critical',
      message: BITGET_ADDRESS_EMPTY_ERROR,
    };
  }

  let currentNetwork = network;
  let currentClient = client;
  const nativeToken = currentClient.chainData.nativeCurrency.symbol as Tokens;
  let currentToken = tokenToSupply || nativeToken;

  const isNativeContract = tokenToSupply === nativeToken;

  const contractInfo = getContractData({
    token: currentToken,
    network: currentNetwork,
    nativeToken,
  });

  const randomNetworksLength = randomNetworks?.length || 0;
  if (randomNetworksLength) {
    const res = await getRandomNetwork({
      wallet,
      randomNetworks,
      logger,
      useUsd,
      nativePrices,
      tokenContractInfo: contractInfo.tokenContractInfo,
      minTokenBalance,
      client: currentClient,
      network: currentNetwork,
      token: currentToken as Tokens,
      isNativeToken: isNativeContract,
      isWithdrawal: false,
    });

    if ('status' in res) {
      return res as TransactionCallbackResponse;
    }
    currentClient = res.client;
    currentNetwork = res.network;
    currentToken = res.token;
  }

  const { explorerLink } = currentClient;

  const bitget = new Bitget({
    network: currentNetwork,
    client: currentClient,
    logger,
  });

  const gasOptions = await getGasOptions({
    gweiRange,
    gasLimitRange,
    network: currentNetwork,
    publicClient: currentClient.publicClient,
  });
  const result = await bitget.makeDeposit({
    minAmount,
    usePercentBalance,
    minAndMaxAmount,
    toAddress,
    minTokenBalance,
    balanceToLeft,
    gasOptions,
    client: currentClient,
    token: currentToken,
  });

  if ('error' in result) {
    return {
      status: 'warning',
      message: result.error,
    };
  }

  let tgMessage;

  if ('tgMessage' in result) {
    tgMessage = result.tgMessage;
  }

  if ('txHash' in result) {
    return {
      status: 'success',
      txHash: result.txHash,
      explorerLink,
      tgMessage,
    };
  }

  return {
    status: 'passed',
    message: result.passedMessage,
    tgMessage,
  };
};
