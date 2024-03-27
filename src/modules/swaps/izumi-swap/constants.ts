import { Hex } from 'viem';

const IZUMI_CONTRACT_FEE = 500;
export const IZUMI_PATH_CONNECTOR =
  '00' +
  ((IZUMI_CONTRACT_FEE / 4096) % 16).toString(16).substring(0, 1) +
  ((IZUMI_CONTRACT_FEE / 256) % 16).toString(16).substring(0, 1) +
  ((IZUMI_CONTRACT_FEE / 16) % 16).toString(16).substring(0, 1) +
  (IZUMI_CONTRACT_FEE % 16).toString(16).substring(0, 1);

type IzumiContracts = {
  quoter: Hex;
  router: Hex;
};

export const IZUMI_CONTRACTS: Record<string, IzumiContracts> = {
  zkSync: {
    quoter: '0x30C089574551516e5F1169C32C6D429C92bf3CD7',
    router: '0x943ac2310D9BC703d6AB5e5e76876e212100f894',
  },
  linea: {
    quoter: '0xe6805638db944eA605e774e72c6F0D15Fb6a1347',
    router: '0x032b241De86a8660f1Ae0691a4760B426EA246d7',
  },
  base: {
    quoter: '0x2db0AFD0045F3518c77eC6591a542e326Befd3D7',
    router: '0x02F55D53DcE23B4AA962CC68b0f685f26143Bdb2',
  },
  scroll: {
    quoter: '0x3EF68D3f7664b2805D4E88381b64868a56f88bC4',
    router: '0x2db0AFD0045F3518c77eC6591a542e326Befd3D7',
  },
  manta: {
    quoter: '0x33531bDBFE34fa6Fd5963D0423f7699775AacaaF',
    router: '0x3EF68D3f7664b2805D4E88381b64868a56f88bC4',
  },
};

export const IZUMI_QUOTER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_factory', type: 'address' },
      { internalType: 'address', name: '_weth', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'WETH9',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'factory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes[]', name: 'data', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ internalType: 'bytes[]', name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenX', type: 'address' },
      { internalType: 'address', name: 'tokenY', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
    ],
    name: 'pool',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [], name: 'refundETH', outputs: [], stateMutability: 'payable', type: 'function' },
  {
    inputs: [
      { internalType: 'uint128', name: 'amount', type: 'uint128' },
      { internalType: 'bytes', name: 'path', type: 'bytes' },
    ],
    name: 'swapAmount',
    outputs: [
      { internalType: 'uint256', name: 'acquire', type: 'uint256' },
      { internalType: 'int24[]', name: 'pointAfterList', type: 'int24[]' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint128', name: 'desire', type: 'uint128' },
      { internalType: 'bytes', name: 'path', type: 'bytes' },
    ],
    name: 'swapDesire',
    outputs: [
      { internalType: 'uint256', name: 'cost', type: 'uint256' },
      { internalType: 'int24[]', name: 'pointAfterList', type: 'int24[]' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenX', type: 'address' },
      { internalType: 'address', name: 'tokenY', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint128', name: 'amount', type: 'uint128' },
      { internalType: 'int24', name: 'lowPt', type: 'int24' },
    ],
    name: 'swapX2Y',
    outputs: [
      { internalType: 'uint256', name: 'amountY', type: 'uint256' },
      { internalType: 'int24', name: 'finalPoint', type: 'int24' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'x', type: 'uint256' },
      { internalType: 'uint256', name: 'y', type: 'uint256' },
      { internalType: 'bytes', name: 'path', type: 'bytes' },
    ],
    name: 'swapX2YCallback',
    outputs: [],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenX', type: 'address' },
      { internalType: 'address', name: 'tokenY', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint128', name: 'desireY', type: 'uint128' },
      { internalType: 'int24', name: 'lowPt', type: 'int24' },
    ],
    name: 'swapX2YDesireY',
    outputs: [
      { internalType: 'uint256', name: 'amountX', type: 'uint256' },
      { internalType: 'int24', name: 'finalPoint', type: 'int24' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenX', type: 'address' },
      { internalType: 'address', name: 'tokenY', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint128', name: 'amount', type: 'uint128' },
      { internalType: 'int24', name: 'highPt', type: 'int24' },
    ],
    name: 'swapY2X',
    outputs: [
      { internalType: 'uint256', name: 'amountX', type: 'uint256' },
      { internalType: 'int24', name: 'finalPoint', type: 'int24' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'x', type: 'uint256' },
      { internalType: 'uint256', name: 'y', type: 'uint256' },
      { internalType: 'bytes', name: 'path', type: 'bytes' },
    ],
    name: 'swapY2XCallback',
    outputs: [],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenX', type: 'address' },
      { internalType: 'address', name: 'tokenY', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint128', name: 'desireX', type: 'uint128' },
      { internalType: 'int24', name: 'highPt', type: 'int24' },
    ],
    name: 'swapY2XDesireX',
    outputs: [
      { internalType: 'uint256', name: 'amountY', type: 'uint256' },
      { internalType: 'int24', name: 'finalPoint', type: 'int24' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'minAmount', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'sweepToken',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'minAmount', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'unwrapWETH9',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  { stateMutability: 'payable', type: 'receive' },
];

export const IZUMI_ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_factory', type: 'address' },
      { internalType: 'address', name: '_weth', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'WETH9',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'factory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes[]', name: 'data', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ internalType: 'bytes[]', name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenX', type: 'address' },
      { internalType: 'address', name: 'tokenY', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
    ],
    name: 'pool',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [], name: 'refundETH', outputs: [], stateMutability: 'payable', type: 'function' },
  {
    inputs: [
      {
        components: [
          { internalType: 'bytes', name: 'path', type: 'bytes' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint128', name: 'amount', type: 'uint128' },
          { internalType: 'uint256', name: 'minAcquired', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        internalType: 'struct Swap.SwapAmountParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'swapAmount',
    outputs: [
      { internalType: 'uint256', name: 'cost', type: 'uint256' },
      { internalType: 'uint256', name: 'acquire', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bytes', name: 'path', type: 'bytes' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint128', name: 'desire', type: 'uint128' },
          { internalType: 'uint256', name: 'maxPayed', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        internalType: 'struct Swap.SwapDesireParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'swapDesire',
    outputs: [
      { internalType: 'uint256', name: 'cost', type: 'uint256' },
      { internalType: 'uint256', name: 'acquire', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenX', type: 'address' },
          { internalType: 'address', name: 'tokenY', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'int24', name: 'boundaryPt', type: 'int24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint128', name: 'amount', type: 'uint128' },
          { internalType: 'uint256', name: 'maxPayed', type: 'uint256' },
          { internalType: 'uint256', name: 'minAcquired', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        internalType: 'struct Swap.SwapParams',
        name: 'swapParams',
        type: 'tuple',
      },
    ],
    name: 'swapX2Y',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'x', type: 'uint256' },
      { internalType: 'uint256', name: 'y', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'swapX2YCallback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenX', type: 'address' },
          { internalType: 'address', name: 'tokenY', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'int24', name: 'boundaryPt', type: 'int24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint128', name: 'amount', type: 'uint128' },
          { internalType: 'uint256', name: 'maxPayed', type: 'uint256' },
          { internalType: 'uint256', name: 'minAcquired', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        internalType: 'struct Swap.SwapParams',
        name: 'swapParams',
        type: 'tuple',
      },
    ],
    name: 'swapX2YDesireY',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenX', type: 'address' },
          { internalType: 'address', name: 'tokenY', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'int24', name: 'boundaryPt', type: 'int24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint128', name: 'amount', type: 'uint128' },
          { internalType: 'uint256', name: 'maxPayed', type: 'uint256' },
          { internalType: 'uint256', name: 'minAcquired', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        internalType: 'struct Swap.SwapParams',
        name: 'swapParams',
        type: 'tuple',
      },
    ],
    name: 'swapY2X',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'x', type: 'uint256' },
      { internalType: 'uint256', name: 'y', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'swapY2XCallback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenX', type: 'address' },
          { internalType: 'address', name: 'tokenY', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'int24', name: 'boundaryPt', type: 'int24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint128', name: 'amount', type: 'uint128' },
          { internalType: 'uint256', name: 'maxPayed', type: 'uint256' },
          { internalType: 'uint256', name: 'minAcquired', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        internalType: 'struct Swap.SwapParams',
        name: 'swapParams',
        type: 'tuple',
      },
    ],
    name: 'swapY2XDesireX',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'minAmount', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'sweepToken',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'minAmount', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'unwrapWETH9',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  { stateMutability: 'payable', type: 'receive' },
];
