import { SupportedNetworks } from '../../../types';
import { ORBITER_BRIDGE_CODES } from './constants';

export const getOrbiterValue = (amount: number, destinationNetwork: SupportedNetworks) => {
  const bridgeCode = ORBITER_BRIDGE_CODES[destinationNetwork];

  if (!bridgeCode) {
    throw new Error(`We do not support [${destinationNetwork}] with the Orbiter bridge`);
  }

  const multipliedAmount = amount * Math.pow(10, 18);
  const amountString = multipliedAmount.toFixed(0);
  const truncatedString = amountString.substring(0, 6);
  const paddedString = truncatedString.padEnd(amountString.length - 4, '0');

  return BigInt(paddedString + bridgeCode);
};
