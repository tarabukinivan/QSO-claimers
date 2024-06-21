import axios from 'axios';
import { Hex } from 'viem';

import { defaultTokenAbi } from '../../../../clients/abi';
import { ClientType, CryptoCompareResult, decimalToInt, getContractData, intToDecimal } from '../../../../helpers';
import { BaseAxiosConfig, SupportedNetworks, TokenContract, Tokens } from '../../../../types';
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

interface GetDonationData {
  client: ClientType;
  amountInt: number;
  nativePrices: CryptoCompareResult;
  network?: SupportedNetworks;
  tokenToSupply?: Tokens;
}
export const getDonationData = async ({
  client,
  amountInt,
  network = 'arbitrum',
  tokenToSupply = 'ETH',
  nativePrices,
}: GetDonationData) => {
  const tokenPrice = nativePrices[tokenToSupply];

  if (!tokenPrice) {
    throw new Error(`Unable to get ${tokenToSupply} price`);
  }

  const donationAmountInt = (amountInt * 0.1) / tokenPrice;
  const { tokenContractInfo, isNativeToken } = getContractData({
    nativeToken: client.chainData.nativeCurrency.symbol as Tokens,
    token: tokenToSupply,
    network,
  });
  const { int: donationBalanceInt, decimals: donationDecimals } = await client.getNativeOrContractBalance(
    isNativeToken,
    tokenContractInfo
  );
  const donationAmountWei = intToDecimal({
    amount: donationAmountInt,
    decimals: donationDecimals,
  });

  return {
    donationBalanceInt,
    donationAmountInt,
    donationAmountWei,
  };
};

export const getAmount = async (eligibilityRes: EligibilityRes) => {
  const amountWei = BigInt(eligibilityRes.zroAllocation.asBigInt);
  const amountInt = decimalToInt({
    amount: amountWei,
    decimals: eligibilityRes.zroAllocation.decimals,
  });

  return {
    amountInt,
    amountWei,
  };
};
