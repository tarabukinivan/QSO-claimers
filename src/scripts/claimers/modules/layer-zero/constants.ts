import { Hex } from 'viem';

import { SupportedNetworks } from '../../../../types';

export const ZRO_CONTRACT: Hex = '0x6985884C4392D348587B19cb9eAAf157F13271cd';

export const ZRO_ABI = [
  {
    inputs: [
      { internalType: 'enumCurrency', name: 'currency', type: 'uint8' },
      { internalType: 'uint256', name: 'amountToDonate', type: 'uint256' },
      { internalType: 'uint256', name: '_zroAmount', type: 'uint256' },
      { internalType: 'bytes32[]', name: '_proof', type: 'bytes32[]' },
      { internalType: 'address', name: '_to', type: 'address' },
      { internalType: 'bytes', name: '_extraBytes', type: 'bytes' },
    ],
    name: 'donateAndClaim',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'guid', type: 'bytes32' },
          { internalType: 'uint64', name: 'nonce', type: 'uint64' },
          {
            components: [
              { internalType: 'uint256', name: 'nativeFee', type: 'uint256' },
              { internalType: 'uint256', name: 'lzTokenFee', type: 'uint256' },
            ],
            internalType: 'structMessagingFee',
            name: 'fee',
            type: 'tuple',
          },
        ],
        internalType: 'structMessagingReceipt',
        name: 'receipt',
        type: 'tuple',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'zroClaimed',
    outputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

export const ZRO_CLAIM_CONTRACTS: Partial<Record<SupportedNetworks, Hex>> = {
  arbitrum: '0xB09F16F625B363875e39ADa56C03682088471523',
  avalanche: '0x9FE91fE878b35c8a3C8c5f8c18c68e5c85FeD144',
  base: '0xf19ccb20726Eab44754A59eFC4Ad331e3bF4F248',
  bsc: '0x9c26831a80Ef7Fb60cA940EB9AA22023476B3468',
  eth: '0xC28C2b2F5A9B2aF1ad5878E5b1AF5F9bAEa2F971',
  optimism: '0x3Ef4abDb646976c096DF532377EFdfE0E6391ac3',
  polygon: '0x9c26831a80Ef7Fb60cA940EB9AA22023476B3468',
};
export const ZRO_CLAIMER_CONTRACTS: Partial<Record<SupportedNetworks, Hex>> = {
  arbitrum: '0xd6b6a6701303B5Ea36fa0eDf7389b562d8F894DB',
  // avalanche: '0x9FE91fE878b35c8a3C8c5f8c18c68e5c85FeD144',
  // base: '0xf19ccb20726Eab44754A59eFC4Ad331e3bF4F248',
  // bsc: '0x9c26831a80Ef7Fb60cA940EB9AA22023476B3468',
  // eth: '0xC28C2b2F5A9B2aF1ad5878E5b1AF5F9bAEa2F971',
  // optimism: '0x3Ef4abDb646976c096DF532377EFdfE0E6391ac3',
  // polygon: '0x9c26831a80Ef7Fb60cA940EB9AA22023476B3468',
};

export const API_URL = 'https://www.layerzero.foundation/api';
