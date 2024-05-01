import axios, { AxiosError } from 'axios';
import Moralis from 'moralis';
import { Hex } from 'viem';

import { MORALIS_KEY } from '../../../../_inputs/settings';
import { defaultTokenAbi } from '../../../../clients/abi';
import { BLOCKSCOUT_ETH_API_URL } from '../../../../constants/urls';
import { ClientType, sleep } from '../../../../helpers';
import { BaseAxiosConfig, SupportedNetworks, TokenContract } from '../../../../types';
import { PROJECT_CONTRACTS } from '../../constants';

interface GetData {
  network: SupportedNetworks;
  walletAddress: Hex;
  chainId: number;
  config?: BaseAxiosConfig;
}
export const getProofData = async ({ network, walletAddress, config }: GetData) => {
  const { data: proofRes } = await axios.get(
    `https://pub-88646eee386a4ddb840cfb05e7a8d8a5.r2.dev/${network === 'bsc' ? '2nd' : network}_data/${walletAddress
      .toLowerCase()
      .slice(2, 5)}.json`,
    config
  );

  return proofRes[walletAddress];
};

export const getTransactionsData = async ({ config, network, walletAddress, chainId }: GetData) => {
  try {
    if (network === 'eth') {
      const { data } = await axios.get(`${BLOCKSCOUT_ETH_API_URL}/addresses/${walletAddress}/transactions`, config);
      return data.items;
    }

    if (network === 'bsc') {
      // TODO: create MORALIS manager
      await Moralis.start({
        apiKey: MORALIS_KEY,
      });

      const txs = [];

      let cursor;
      let shouldStop = false;
      while (!shouldStop) {
        const response = await Moralis.EvmApi.transaction.getWalletTransactions({
          address: walletAddress,
          chain: chainId,
          cursor,
        });

        const result = response.toJSON();

        for (const tx of result.result) {
          txs.push(tx);
        }

        cursor = response.pagination.cursor;

        if (!cursor) {
          shouldStop = true;
        } else {
          await sleep(30);
        }
      }

      return txs;
    }

    return [];
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
  network: SupportedNetworks;
  chainId: number;
  config?: BaseAxiosConfig;
}
export const getTransactionData = async ({ config, txHash, network, chainId }: GetTransactionData) => {
  try {
    if (network === 'eth') {
      const { data } = await axios.get(`${BLOCKSCOUT_ETH_API_URL}/transactions/${txHash}`, config);
      return data;
    }

    if (network === 'bsc') {
      await Moralis.start({
        apiKey: MORALIS_KEY,
      });

      const response = await Moralis.EvmApi.transaction.getTransaction({
        chain: chainId,
        transactionHash: txHash,
      });

      return response?.toJSON();
    }

    return null;
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
