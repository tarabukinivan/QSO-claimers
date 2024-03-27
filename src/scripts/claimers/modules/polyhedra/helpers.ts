import axios, { AxiosError } from 'axios';
import { Hex } from 'viem';

import { defaultTokenAbi } from '../../../../clients/abi';
import { BLOCKSCOUT_ETH_API_URL } from '../../../../constants/urls';
import { ClientType } from '../../../../helpers';
import { BaseAxiosConfig, SupportedNetworks, TokenContract } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';

interface GetData {
  network: SupportedNetworks;
  walletAddress: Hex;
  config?: BaseAxiosConfig;
}
export const getProofData = async ({ network, walletAddress, config }: GetData) => {
  const { data: proofRes } = await axios.get(
    `https://pub-88646eee386a4ddb840cfb05e7a8d8a5.r2.dev/${network}_data/${walletAddress
      .toLowerCase()
      .slice(2, 5)}.json`,
    config
  );

  return proofRes[walletAddress];
};

export const getTransactionsData = async ({ config, walletAddress }: GetData) => {
  try {
    const { data } = await axios.get(`${BLOCKSCOUT_ETH_API_URL}/addresses/${walletAddress}/transactions`, config);
    return data.items;
  } catch (err) {
    let errMessage = (err as Error).message;
    if (err instanceof AxiosError) {
      errMessage = err.response?.data.message || errMessage;
    }
    if (errMessage.includes('Not found')) return [];

    throw err;
  }
};

interface GetTransactionData {
  txHash: Hex;
  config?: BaseAxiosConfig;
}
export const getTransactionData = async ({ config, txHash }: GetTransactionData) => {
  try {
    const { data } = await axios.get(`${BLOCKSCOUT_ETH_API_URL}/transactions/${txHash}`, config);
    return data;
  } catch (err) {
    let errMessage = (err as Error).message;
    if (err instanceof AxiosError) {
      errMessage = err.response?.data.message || errMessage;
    }
    if (errMessage.includes('Not found')) return null;

    throw err;
  }
};

export const getBalance = async (client: ClientType) => {
  const contract = PROJECT_CONTRACTS.zkAddress as Hex;
  const contractInfo: TokenContract = {
    name: 'ZK',
    address: contract,
    abi: defaultTokenAbi,
  };
  const { int: currentBalance } = await client.getBalanceByContract(contractInfo);

  return currentBalance;
};
