import { Hex } from 'viem';

import { SupportedNetworks } from '../../types';

export const BASE_NETWORK: SupportedNetworks = 'eth';

// CONTRACTS
export const PROJECT_CONTRACTS: Record<string, Hex> = {
  zkClaim: '0x9234f83473c03be04358afc3497d6293b2203288',
  zkAddress: '0xC71B5F631354BE6853eFe9C3Ab6b9590F8302e81',
};

// PATHS
export const LOGGER_PATH = '../../_outputs/logs/';
