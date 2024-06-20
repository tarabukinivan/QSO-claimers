import { DataSource } from 'typeorm';
import { Hex } from 'viem';

import { CryptoCompareResult, TransactionCallbackResponse } from '../helpers';
import { LoggerData, LoggerType } from '../logger';
import { Cex, NumberRange, ProxyAgent, ProxyObject, WalletData } from './common';
import { BinanceNetworks, OkxNetworks, SupportedNetworks } from './networks';
import { AvailableRemainSwapTokens, AvailableSwapTokens, Tokens } from './tokens';

export type WorkerResponse = Pick<TransactionCallbackResponse, 'status' | 'message' | 'tgMessage'> & {
  logTemplate: LoggerData;
};

export type FindModuleReturnFc = (params: TransformedModuleParams) => Promise<WorkerResponse>;

export type ModuleNames =
  | 'binance-withdraw'
  | 'okx-withdraw'
  | 'okx-collect'
  | 'top-up-eth-mainnet'
  | 'transfer-token'
  | 'balance-checker'
  | 'check-native-balance'
  | 'izumi-swap'
  | 'sync-swap'
  | '1inch-swap'
  | 'routernitro-bridge'
  | 'orbiter-bridge'
  | 'polyhedra-claim'
  | 'polyhedra-check-claim'
  | 'polyhedra-transfer-claim'
  | 'layerZero-claim'
  | 'layerZero-transfer-claim';

export type SwapModuleNames = Extract<
  ModuleNames,
  'odos-swap' | 'izumi-swap' | 'sync-swap' | '1inch-swap' | 'zkSync-mute-swap'
>;

export type MaxGas = [SupportedNetworks, number];
export type HexOrNative = Hex | 'native';
export type ContractPairs = [HexOrNative, HexOrNative];
export type Pairs = [AvailableSwapTokens, AvailableSwapTokens];

export interface ExtraModuleParams {
  // General
  network?: SupportedNetworks;
  randomNetworks?: SupportedNetworks[];
  gweiRange?: NumberRange;
  gasLimitRange?: NumberRange;
  maxGas?: MaxGas;
  useInvitesAutosave?: boolean;
  stopWalletOnError?: boolean;
  stopWalletOnPassed?: boolean;
  stopModulesOnError?: ModuleNames[];

  destinationNetwork?: SupportedNetworks;
  destinationNetworks?: SupportedNetworks[];
  contractAddress?: HexOrNative;
  contractAddresses?: Hex[];
  projectAddresses?: Hex[];

  useUsd?: boolean;

  // Swaps / Liquidity / Lending
  srcToken?: AvailableSwapTokens;
  destTokens?: [AvailableSwapTokens, ...AvailableSwapTokens[]];
  pairs?: Pairs;
  networkPairs?: [SupportedNetworks, SupportedNetworks];
  contractPairs?: ContractPairs;
  reverse?: boolean;
  slippage?: number;
  tokenToSupply?: Tokens;
  collateral?: 'disable' | 'enable';
  swapsByToken?: Record<AvailableSwapTokens, [SwapModuleNames, ...SwapModuleNames[]] | 'all'>;
  tokensToRemainSwap?: AvailableRemainSwapTokens[] | 'all';

  // Withdraws
  tokenToWithdraw?: Tokens;
  withdrawAdditionalPercent?: number;
  reservePercentNetworkFee?: number;

  binanceWithdrawNetwork?: BinanceNetworks;
  randomBinanceWithdrawNetworks?: BinanceNetworks[];

  okxWithdrawNetwork?: OkxNetworks;
  randomOkxWithdrawNetworks?: OkxNetworks[];
  okxWithdrawFees?: number;
  okxAccounts?: string[] | 'all';
  okxCollectTokens?: Tokens[];

  withdrawNetwork?: string;
  randomCex?: [Cex, ...Cex[]];

  // Amounts
  reverseMinAndMaxAmount?: NumberRange;
  minAndMaxAmount?: NumberRange;
  minAmount?: number;
  amount?: number;
  usePercentBalance?: boolean;
  minTokenBalance?: number;
  minNativeBalance?: number;
  minDestTokenBalance?: number;
  minDestNativeBalance?: number;

  expectedBalance?: NumberRange;

  minNativeBalanceNetwork?: SupportedNetworks;

  // ZkEra
  zkEraBridgeAmount?: NumberRange;
  checkZkEraBalance?: boolean;

  balanceToLeft?: NumberRange;

  maxTxsCount?: NumberRange;
  maxFee?: number;
  bytecode?: Hex;
}

export interface DefaultModuleConfig extends ExtraModuleParams {
  count: NumberRange;
  indexGroup: number;
  delay?: NumberRange;
}

export type UserModuleConfig = Partial<DefaultModuleConfig> & {
  moduleName: ModuleNames;
};
export type ModuleConfig = Required<UserModuleConfig>;

export type GroupedModules = Record<number, ModuleConfig[]>;

export type ModuleParams = ModuleConfig & ExtraModuleParams;

export type DefaultModuleConfigs = Record<ModuleNames, DefaultModuleConfig>;

export type TransformedModuleParams = Omit<ModuleParams, 'count'> & {
  moduleIndex: number;
  count: number;
  proxyAgent?: ProxyAgent;
  proxyObject?: ProxyObject;
  isReverse?: boolean;
  logger: LoggerType;
  wallet: WalletData;

  baseNetwork: SupportedNetworks;
  projectName: string;
  nativePrices: CryptoCompareResult;

  dbSource?: DataSource;
};

export type TransformedModuleConfig = Omit<ModuleConfig, 'count'> & {
  count: number;
  isReverse?: boolean;
  isFailed?: boolean;
};

export interface StopModuleOnError {
  errorFrom: ModuleNames;
  moduleToStop: ModuleNames;
}
