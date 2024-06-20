import axios from 'axios';
import { Hex } from 'viem';

import { defaultTokenAbi } from '../../../../clients/abi';
import { ClientType } from '../../../../helpers';
import { BaseAxiosConfig, SupportedNetworks, TokenContract } from '../../../../types';
import { API_URL, ZRO_CONTRACT } from './constants';

interface GetData {
  network: SupportedNetworks;
  walletAddress: Hex;
  chainId: number;
  config?: BaseAxiosConfig;
}
interface EligibilityRes {
  address: string;
  isEligible: boolean;
  zroAllocation: {
    asBigInt: string; // '68846352177000006000'
    asString: string; // '68.85'
    decimals: number; // 18
  };
}
export const getEligibilityData = async ({ walletAddress, config }: GetData): Promise<EligibilityRes> => {
  const { data } = await axios.get(`${API_URL}/allocation/${walletAddress.toLowerCase()}`, config);

  return data;
};

interface ProofRes {
  address: string;
  proof: string;
  amount: string;
}
export const getProofData = async ({ walletAddress, config }: GetData): Promise<ProofRes> => {
  const { data } = await axios.get(`${API_URL}/proof/${walletAddress.toLowerCase()}`, config);

  return data;
};

export const getBalance = async (client: ClientType) => {
  const contractInfo: TokenContract = {
    name: 'ZRO',
    address: ZRO_CONTRACT,
    abi: defaultTokenAbi,
  };
  const { int: currentBalance } = await client.getBalanceByContract(contractInfo);

  return currentBalance;
};
