import {
  DefaultModuleConfigs,
  NumberRange,
  RouteSettings,
  TransformedModuleConfig,
  WalletData,
  WalletWithModules,
} from '../../types';

export interface BaseArgs {
  projectName: string;
}

export type SaveModules = BaseArgs & {
  walletsWithModules: WalletWithModules[];
  route: string;
};

export type PrepareModulesArgs = {
  routeSettings: RouteSettings;
  delayBetweenTransactions: NumberRange;
  shouldShuffleModules: boolean;
  defaultModuleConfigs: DefaultModuleConfigs;
};

export type GetUpdatedModulesCallback = (module: TransformedModuleConfig) => TransformedModuleConfig[] | void;
export type GetUpdatedModulesCallbackProp = {
  getUpdatedModulesCallback: GetUpdatedModulesCallback;
};

export interface UpdateSavedModulesCount extends BaseArgs {
  wallet: WalletData;
  moduleIndex: number;
  setZeroCount?: boolean;
}
