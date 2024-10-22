import { SupportedNetworks } from '../../types';

export const checkLegacyTypeByNetwork = (network: SupportedNetworks) => {
  const legacyTypeNetworks: SupportedNetworks[] = [];

  return legacyTypeNetworks.includes(network);
};
