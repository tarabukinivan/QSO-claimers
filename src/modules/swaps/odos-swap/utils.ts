import axios from 'axios';
import { Hex } from 'viem';

import { BaseAxiosConfig } from '../../../types';
import { ODOS_API_URL } from './constants';

interface GetQuoteParams {
  amount: bigint;
  srcTokenContract: Hex;
  dstTokenContract: Hex;
  config: BaseAxiosConfig;
  chainId: number;
  slippage: number;
  walletAddress: Hex;
}

export const getQuote = async ({
  amount,
  config,
  chainId,
  slippage,
  walletAddress,
  srcTokenContract,
  dstTokenContract,
}: GetQuoteParams) => {
  const { data } = await axios.post(
    `${ODOS_API_URL}/sor/quote/v2`,
    {
      chainId,
      inputTokens: [
        {
          amount: `${amount}`,
          tokenAddress: srcTokenContract,
        },
      ],
      outputTokens: [
        {
          proportion: 1,
          tokenAddress: dstTokenContract,
        },
      ],
      slippageLimitPercent: slippage,
      userAddr: walletAddress,
    },
    config
  );

  return data.pathId;
};

interface AssembleTxParams {
  pathId: number;
  config: BaseAxiosConfig;
  walletAddress: Hex;
}

export const assembleTx = async ({ pathId, config, walletAddress }: AssembleTxParams) => {
  const { data } = await axios.post(
    `${ODOS_API_URL}/sor/assemble`,
    {
      pathId,
      userAddr: walletAddress,
      simulate: false,
    },
    config
  );

  return data.transaction;
};
