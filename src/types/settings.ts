import { RangeByIdFilter } from '../helpers';
import { AutoGasNetworks } from '../managers/auto-gas/types';
import { MoreOrLessString, NumberRange } from './common';
import { UserModuleConfig } from './module';
import { SupportedNetworks } from './networks';
import { AvailableSwapTokens } from './tokens';

export type MaxGasSetting = Partial<Record<SupportedNetworks, number>>;
export type GasMultiplierSettings = Partial<Record<SupportedNetworks, number>>;

export interface SettingsDelays {
  beforeTxReceipt: NumberRange;
  betweenTransactions: NumberRange;
  betweenModules: NumberRange;
  betweenWallets: NumberRange;
  betweenCheckGas: NumberRange;
  betweenRetries: number;
  betweenRestarts: number;
}

export interface AutoGasNetworkSettings {
  useAutoGas: boolean;
  cex: 'binance' | 'okx';
  minBalance: number;
  withdrawToAmount: NumberRange;
  withdrawSleep: NumberRange;
  expectedBalance?: NumberRange;
}
export type AutoGasSettings = Partial<Record<AutoGasNetworks, AutoGasNetworkSettings>>;

export interface ShuffleSettings {
  wallets: boolean;
  modules: boolean;
}

interface InvitesAmount {}

export interface FilterSettings {
  useFilter: boolean;
  usePrevData: boolean;

  hasThisMonthTx: boolean | null;
  txCount: MoreOrLessString | null;
  days: MoreOrLessString | null;
  weeks: MoreOrLessString | null;
  months: MoreOrLessString | null;
  contracts: MoreOrLessString | null;
  balanceETH: MoreOrLessString | null;
  balanceUSDT: MoreOrLessString | null;
  balanceUSDC: MoreOrLessString | null;
  balanceDAI: MoreOrLessString | null;
  balance_eETH: MoreOrLessString | null;
  volume: MoreOrLessString | null;
}

export type MinTokenBalanceSettings = Partial<Record<AvailableSwapTokens, number>>;

export interface DefaultSettings {
  routes?: Route[];

  shuffle: ShuffleSettings;
  threads: number;
  txAttempts: number;
  delay: SettingsDelays;
  maxGas: MaxGasSetting;
  gasMultiplier: GasMultiplierSettings;
  invitesAmount?: InvitesAmount;
  autoGas: AutoGasSettings;

  txAttemptsToChangeProxy: number;
  useProxy: boolean;
  useRestartInMain: boolean;
  useSavedModules: boolean;
  idFilter: RangeByIdFilter;
  minTokenBalance: MinTokenBalanceSettings;
}

// =================================================================
export type Route =
  | 'base'
  | 'flow-1'
  | 'flow-2'
  | 'flow-3'
  | 'flow-4'
  | 'one-time'
  | 'low-cost'
  | 'top-up-balance'
  | 'warm-up'
  | 'volume'
  | 'dev'
  | 'checkers'
  | 'new-accounts'
  | 'polyhedra'
  | 'alt-layer'
  | 'check-balances';

export type Settings = DefaultSettings;

export type GroupSettings = Record<number, NumberRange>;

export type RouteSettings = {
  modules: UserModuleConfig[];
  groupSettings: GroupSettings;
  countModules: NumberRange;
  limitWalletsToUse: number;
  splitModuleCount?: boolean;
};
