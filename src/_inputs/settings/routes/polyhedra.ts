// Описание роута:
// Базовый роут, который предназначен для запуска, после деплоя кошелька для набива транзакций и контрактов

import { GroupSettings, NumberRange, RouteSettings, UserModuleConfig } from '../../../types';

// ====================== MODULES ======================
// Из всех модулей, возьмёт только 1 рандомный
// Укажите [0, 0] если хотите чтобы использовались все модули
const countModules = [0, 0] as NumberRange;

const groupSettings: GroupSettings = {};

const modules: UserModuleConfig[] = [
  {
    moduleName: 'polyhedra-check-claim',
    network: 'bsc',
    indexGroup: 0,
  },
  // {
  //   moduleName: 'polyhedra-claim',
  //   gweiRange: [1.01, 1.04],
  //
  //   network: 'bsc',
  //
  //   stopWalletOnError: true,
  //
  //   indexGroup: 1,
  // },
  // {
  //   moduleName: 'polyhedra-transfer-claim',
  //
  //   stopWalletOnError: true,
  //
  //   indexGroup: 2,
  // },
  // {
  //   moduleName: 'transfer-token',
  //   count: [1, 1],
  //   indexGroup: 3,
  //
  //   // Диапазон для трансфера
  //   minAndMaxAmount: [100, 100],
  //   usePercentBalance: true,
  //
  //   // Сеть в которой будет выполняться модуль (bsc | opBNB | eth | optimism | zkSync | arbitrum | polygon | zora | base )
  //   network: 'eth',
  //
  //   // Контракт токена для трансфера или используйте 'native' для трансфера нативного токена указанной сети
  //   contractAddress: 'native',
  // },
];

// Выполнит скрипт на указанном количестве кошельков
// То есть из 100 кошельков, которые попадут под фильтр - возьмёт в работу только первые
// Если хотите отключить, укажите 0!
const limitWalletsToUse = 0;

// Перемешает все транзакции конкретного модуля между всеми модулями.
// Если у вас будет указано false, тогда транзакции модуля, которые указаны в count будут вызываться одна за одной.
// Если указали true:
// Вот это - [{ moduleName: 'starkVerse', count: [2,2] }, { moduleName: 'dmail', count: [2,2] }]
// Превратится в это - [{moduleName: 'starkVerse', count: [1,1]}, {moduleName: 'starkVerse', count: [1,1]}, {moduleName: 'dmail', count: [1,1]}, {moduleName: 'dmail', count: [1,1]}]
// А если вы указали в settings.shuffle.modules: true, тогда они еще перемешаются между собой.
const splitModuleCount = false;

export const flow: RouteSettings = {
  modules,
  countModules,
  groupSettings,
  limitWalletsToUse,
  splitModuleCount,
};
