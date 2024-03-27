import axios from 'axios';
import { Wallet } from 'ethers';

import {
  calculateAmount,
  decryptKey,
  getAxiosConfig,
  getClientByNetwork,
  getUserAgentHeader,
  sleep,
  TransactionCallbackParams,
  TransactionCallbackReturn,
  transactionWorker,
} from '../../../helpers';
import { SupportedNetworks, TransformedModuleParams } from '../../../types';

export const execMakeMesonBridge = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make meson bridge...',
    transactionCallback: makeMesonBridge,
  });

const API_URL = 'https://relayer.meson.fi/api/v1/swap';
const EXPLORER_URL = 'https://explorer.meson.fi/swap';
export const makeMesonBridge = async (params: TransactionCallbackParams): TransactionCallbackReturn => {
  const {
    client,
    network,
    wallet,
    logger,
    destinationNetwork,
    minAndMaxAmount,
    minTokenBalance,
    usePercentBalance,
    tokenToSupply,
    proxyAgent,
  } = params;

  const token = tokenToSupply.toLowerCase();
  const { walletAddress } = client;

  const destinationClient = getClientByNetwork(destinationNetwork, wallet.privKey, logger);
  const destinationBalance = await destinationClient.getNativeBalance();

  const networkName = NETWORK_NAME_MAP[network] || network;
  const destinationNetworkName = NETWORK_NAME_MAP[destinationNetwork] || destinationNetwork;

  if (destinationBalance.int >= minTokenBalance) {
    return {
      status: 'success',
      message: `Balance of ${destinationNetwork}=${destinationBalance.int} already more or equal than ${minTokenBalance}`,
    };
  }

  const userAgent = getUserAgentHeader();
  const config = await getAxiosConfig({
    proxyAgent,
    headers: {
      ...userAgent,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  const balance = await client.getNativeBalance();
  const amount = calculateAmount({
    balance: balance.int,
    minAndMaxAmount,
    usePercentBalance,
    decimals: balance.decimals,
  }).toFixed(6);

  const baseData = {
    fromAddress: walletAddress.toLowerCase(),
    recipient: walletAddress.toLowerCase(),
  };
  const { data } = await axios.post(
    API_URL,
    {
      from: `${networkName}:${token}`,
      to: `${destinationNetworkName}:${token}`,
      amount,
      ...baseData,
    },
    config
  );

  // const dataToSign = data.result.dataToSign;

  // if (
  //   keccak256(dataToSign[0].message) !== dataToSign[0].hash ||
  //   keccak256(dataToSign[1].message) !== dataToSign[1].hash
  // ) {
  //   throw new Error('Invalid hash');
  // }

  const decryptedPrivKey = decryptKey(wallet.privKey);
  const etherWallet = new Wallet(decryptedPrivKey);

  const dataToSign = data.result.signingRequest;

  // const sig0 = etherWallet.signingKey.sign(dataToSign[0].hash);
  // const sig1 = etherWallet.signingKey.sign(dataToSign[1].hash);

  // const signatures = [sig0.serialized, sig1.serialized];
  const sig = etherWallet.signingKey.sign(dataToSign.hash);
  const signature = sig.serialized;

  const encoded = data.result.encoded;

  logger.info(
    `Making bridge of ${amount} ETH from ${network} to ${destinationNetwork}. Total fee is ${data.result.fee.totalFee}`
  );

  const { data: submitData } = await axios.post(
    `${API_URL}/${encoded}`,
    {
      fromAddress: walletAddress,
      recipient: walletAddress,
      signature,
    },
    config
  );

  const swapId = submitData.result.swapId;

  logger.info(`Bridge in progress. You can check it here ${EXPLORER_URL}/${swapId}`);

  await sleep(60);

  let checkResult;
  while (!checkResult) {
    const { data } = await axios.get(`${API_URL}/${swapId}`, config);

    if (Object.keys(data.result).length) {
      checkResult = data.result;
    } else {
      logger.info('Bridge still in progress...');

      await sleep(60);
    }
  }

  if (checkResult.expired) {
    return {
      status: 'error',
      message: `Bridge expired. Check result ${EXPLORER_URL}/${swapId}`,
    };
  }

  return {
    status: 'success',
    message: `Bridge was done successfully. Check result ${EXPLORER_URL}/${swapId}`,
  };
};

const NETWORK_NAME_MAP: Partial<Record<SupportedNetworks, string>> = {
  arbitrum: 'arb',
  bsc: 'bnb',
  optimism: 'opt',
  avalanche: 'avax',
  polygon_zkevm: 'zkevm',
  zkFair: 'zkfair',
  zkSync: 'zksync',
  opBNB: 'opbnb',
};
