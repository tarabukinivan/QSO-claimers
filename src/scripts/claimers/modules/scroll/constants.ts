import { getAddress, Hex } from 'viem';

export const CLAIM_SCROLL_CONTRACT: Hex = '0xE8bE8eB940c0ca3BD19D911CD3bEBc97Bea0ED62';
export const SCROLL_TOKEN_CONTRACT: Hex = getAddress('0xd29687c813D741E2F938F4aC377128810E217b1b');

export const SCROLL_ABI = [
  {
    type: 'function',
    inputs: [
      {
        name: '_account',
        internalType: 'address',
        type: 'address',
      },
      {
        name: '_amount',
        internalType: 'uint256',
        type: 'uint256',
      },
      {
        name: '_merkleProof',
        internalType: 'bytes32[]',
        type: 'bytes32[]',
      },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'delegate',
    inputs: [
      {
        name: '_partialDelegations',
        type: 'tuple[]',
        internalType: 'struct PartialDelegation[]',
        components: [
          {
            name: '_delegatee',
            type: 'address',
            internalType: 'address',
          },
          {
            name: '_numerator',
            type: 'uint96',
            internalType: 'uint96',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'delegates',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct PartialDelegation[]',
        components: [
          {
            name: '_delegatee',
            type: 'address',
            internalType: 'address',
          },
          {
            name: '_numerator',
            type: 'uint96',
            internalType: 'uint96',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasClaimed',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'claimed',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
];

export const API_URL = 'https://claim.scroll.io';

export const HEADERS = {
  Accept: 'text/x-component',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'Content-Type': 'text/plain;charset=UTF-8',
  'Next-Action': '2ab5dbb719cdef833b891dc475986d28393ae963',
  Referer: 'https://claim.scroll.io/',
  Origin: 'https://claim.scroll.io',
  'Next-Router-State-Tree':
    '%5B%22%22%2C%7B%22children%22%3A%5B%22(claim)%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2C%22%2F%3Fstep%3D1%22%2C%22refresh%22%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
};
