import axios from 'axios';
import { Hex } from 'viem';

import { defaultTokenAbi } from '../../../../clients/abi';
import { ClientType } from '../../../../helpers';
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
