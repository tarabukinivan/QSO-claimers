import { Hex } from 'viem';

export function convertPrivateKey(privateKey: string): Hex {
  if (privateKey.startsWith('0x')) {
    return privateKey as Hex;
  } else {
    return `0x${privateKey}`;
  }
}
