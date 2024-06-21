// TODO: add all makers
import { SupportedNetworks } from '../../../types';

export const MIN_AMOUNT_TO_BRIDGE = 0.0001;
export const MAX_AMOUNT_TO_BRIDGE = 5;
export const TRADING_FEE = 0.0012;

export const ORBITER_BRIDGE_CONTRACT = '0x80C67432656d59144cEFf962E8fAF8926599bCF8';

export const ORBITER_BRIDGE_CODES: Partial<Record<SupportedNetworks, number>> = {
  eth: 9001,
  optimism: 9007,
  bsc: 9015,
  arbitrum: 9002,
  // nova: 9016,
  polygon: 9006,
  polygon_zkevm: 9017,
  zkSync: 9014,
  // zksync_lite: 9003,
  // starknet: 9004,
  linea: 9023,
  base: 9021,
  // mantle: 9024,
  scroll: 9019,
  zora: 903,
  // blast: 904,
};
