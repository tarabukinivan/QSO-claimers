// Описание роута:
// Базовый роут, который предназначен для запуска, после деплоя кошелька для набива транзакций и контрактов

import { GroupSettings, NumberRange, RouteSettings, UserModuleConfig } from '../../../types';

// ====================== MODULES ======================
// Из всех модулей, возьмёт только 1 рандомный
// Укажите [0, 0] если хотите чтобы использовались все модули
const countModules = [0, 0] as NumberRange;

const groupSettings: GroupSettings = {
  1: [1, 1],
};

const modules: UserModuleConfig[] = [
  {
    moduleName: 'layer-zero-check-claim',

    indexGroup: 0,
  },
  {
    moduleName: 'okx-withdraw',

    okxWithdrawNetwork: 'arbitrum',
    tokenToWithdraw: 'ETH',

    // Добавит к значению вывода еще посчитанный минимальный донат для клейма
    addDonationAmount: true,
    expectedBalance: [0.0011, 0.0015],
    minTokenBalance: 0.0011,

    indexGroup: 1,
  },
  {
    moduleName: 'binance-withdraw',

    binanceWithdrawNetwork: 'arbitrum',
    tokenToWithdraw: 'ETH',

    // Добавит к значению вывода еще посчитанный минимальный донат для клейма
    addDonationAmount: true,
    expectedBalance: [0.0011, 0.0015],
    minTokenBalance: 0.0011,

    indexGroup: 1,
  },
  {
    moduleName: 'layer-zero-claim',
    network: 'arbitrum',

    indexGroup: 3,
  },
  {
    moduleName: 'layer-zero-transfer-claim',
    minAndMaxAmount: [100, 100],
    network: 'arbitrum',

    indexGroup: 4,
  },
  {
    moduleName: 'transfer-token',
    network: 'arbitrum',

    minAndMaxAmount: [98, 99],
    usePercentBalance: true,

    // Контракт токена для трансфера или используйте 'native' для трансфера нативного токена указанной сети
    contractAddress: 'native',

    indexGroup: 5,
  },
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
