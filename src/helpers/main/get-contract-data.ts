import { defaultTokenAbi } from '../../clients/abi';
import { SupportedNetworks, TokenContract, Tokens } from '../../types';
import { getTokenContract } from '../get-token-contract';

interface GetContractData {
  nativeToken: Tokens;
  network: SupportedNetworks;
  contractInfo?: TokenContract;
  token?: Tokens;
}
export const getContractData = ({ nativeToken, token, network, contractInfo }: GetContractData) => {
  let tokenContractInfo;

  const currentToken = token || nativeToken;
  const isNativeToken = currentToken === nativeToken;

  if (!isNativeToken) {
    const tokenContract = (
      contractInfo ||
      getTokenContract({
        tokenName: currentToken,
        network,
      })
    ).address;

    tokenContractInfo = {
      name: currentToken,
      address: tokenContract,
      abi: defaultTokenAbi,
    } as TokenContract;
  }

  return { tokenContractInfo, isNativeToken, token: currentToken };
};
