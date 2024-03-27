import axios, { AxiosError } from 'axios';
import { Hex } from 'viem';

import { BaseAxiosConfig } from '../../../types';

interface BuildTxDataParams {
  src: Hex;
  dst: Hex;
  from: Hex;
  config: BaseAxiosConfig;
  amount: bigint;
  chainId: number;
  slippage: number;
}

export const buildTxData = async ({ config, ...apiParams }: BuildTxDataParams) => {
  const url = `https://api.1inch.dev/swap/v6.0/${apiParams.chainId}/swap`;

  try {
    const { data } = await axios.get(url, {
      ...config,
      params: apiParams,
    });

    return data;
  } catch (e) {
    const error = e as AxiosError<{ description: string }>;
    const errorMessage = error.response?.data?.description;

    throw new Error(errorMessage || error.message);
  }
};

interface GetRouterContractParams {
  config: BaseAxiosConfig;
  chainId: number;
}

export const getRouterContract = async ({ config, chainId }: GetRouterContractParams) => {
  const url = `https://api.1inch.dev/swap/v6.0/${chainId}/approve/spender`;

  try {
    const { data } = await axios.get(url, config);

    return data.address;
  } catch (e) {
    const error = e as AxiosError<{ description: string }>;
    const errorMessage = error.response?.data?.description;

    throw new Error(errorMessage || error.message);
  }
};
