import { readFileSync } from 'fs';
import { sep } from 'path';

import { OUTPUTS_JSON_FOLDER } from '../../constants';
import { ModuleNames, SavedModules, WalletData, WalletWithModules } from '../../types';
import { printResults } from '../file-handlers';
import { getFileNameWithPrefix } from '../msg-to-template';
import { prepareSavedWalletsWithModules } from '../wallets';
import { BaseArgs, SaveModules, UpdateSavedModulesCount } from './types';

export const savePreparedModules = ({ route, walletsWithModules, projectName }: SaveModules) => {
  printResults<SavedModules>({
    data: JSON.stringify(
      {
        isFinished: false,
        route,
        walletsWithModules,
      },
      null,
      2
    ),
    fileName: getFileNameWithPrefix(projectName, 'saved-modules.json'),
    outputPath: OUTPUTS_JSON_FOLDER,
  });
};

export const clearSavedModules = (projectName: string) => {
  const fileName = getFileNameWithPrefix(projectName, 'saved-modules.json');
  printResults({ data: '{}', fileName, outputPath: OUTPUTS_JSON_FOLDER });
};

export const clearSavedWallet = (wallet: WalletData, projectName: string) => {
  const fileName = getFileNameWithPrefix(projectName, 'saved-modules.json');

  const transformDataCallback = (data: SavedModules) => {
    const savedModules = data.walletsWithModules?.reduce<WalletWithModules[]>((acc, cur) => {
      if (cur.wallet.id === wallet.id && cur.wallet.index === wallet.index) {
        return acc;
      }

      return [...acc, cur];
    }, []);
    return {
      ...data,
      walletsWithModules: savedModules,
    };
  };

  printResults<SavedModules>({
    data: '{}',
    fileName,
    outputPath: OUTPUTS_JSON_FOLDER,
    transformDataCallback,
    withAppend: true,
  });
};

export const updateSavedModulesCount = ({
  wallet,
  moduleIndex,
  projectName,
  setZeroCount = false,
}: UpdateSavedModulesCount) => {
  const transformDataCallback = (data: SavedModules) => {
    const savedModules = data.walletsWithModules?.reduce<WalletWithModules[]>((acc, cur) => {
      if (cur.wallet.id === wallet.id && cur.wallet.index === wallet.index) {
        const updatedModules = cur.modules.map(({ count, ...restModule }, index) => {
          const newCount = moduleIndex === index ? (setZeroCount ? 0 : count - 1) : count;

          return {
            ...restModule,
            count: newCount,
          };
        });

        const updatedWalletWithModules = {
          ...cur,
          modules: updatedModules,
        } as WalletWithModules;

        return [...acc, updatedWalletWithModules];
      }

      return [...acc, cur];
    }, []);
    return {
      ...data,
      walletsWithModules: savedModules,
    };
  };

  printResults<SavedModules>({
    data: '{}',
    fileName: getFileNameWithPrefix(projectName, 'saved-modules.json'),
    outputPath: OUTPUTS_JSON_FOLDER,
    transformDataCallback,
    withAppend: true,
  });
};

export const markSavedModulesAsError = ({ wallet, moduleIndex, projectName }: UpdateSavedModulesCount) => {
  const transformDataCallback = (data: SavedModules) => {
    const savedModules = data.walletsWithModules?.reduce<WalletWithModules[]>((acc, cur) => {
      if (cur.wallet.id === wallet.id && cur.wallet.index === wallet.index) {
        const updatedModules = cur.modules.map(({ ...restModule }, index) => {
          return {
            ...restModule,
            ...(moduleIndex === index && {
              isFailed: true,
            }),
          };
        });

        const updatedWalletWithModules = {
          ...cur,
          modules: updatedModules,
        } as WalletWithModules;

        return [...acc, updatedWalletWithModules];
      }

      return [...acc, cur];
    }, []);
    return {
      ...data,
      walletsWithModules: savedModules,
    };
  };

  printResults<SavedModules>({
    data: '{}',
    fileName: getFileNameWithPrefix(projectName, 'saved-modules.json'),
    outputPath: OUTPUTS_JSON_FOLDER,
    transformDataCallback,
    withAppend: true,
  });
};

interface ClearAllSavedModulesByName {
  wallet: WalletData;
  projectName: string;
  moduleName: ModuleNames;
}
export const clearAllSavedModulesByName = ({ wallet, projectName, moduleName }: ClearAllSavedModulesByName) => {
  const transformDataCallback = (data: SavedModules) => {
    const savedModules = data.walletsWithModules?.reduce<WalletWithModules[]>((acc, cur) => {
      if (cur.wallet.id === wallet.id && cur.wallet.index === wallet.index) {
        const updatedModules = cur.modules.map(({ count, ...restModule }) => {
          const newCount = moduleName === restModule.moduleName ? 0 : count;

          return {
            ...restModule,
            count: newCount,
          };
        });

        const updatedWalletWithModules = {
          ...cur,
          modules: updatedModules,
        } as WalletWithModules;

        return [...acc, updatedWalletWithModules];
      }

      return [...acc, cur];
    }, []);
    return {
      ...data,
      walletsWithModules: savedModules,
    };
  };

  printResults<SavedModules>({
    data: '{}',
    fileName: getFileNameWithPrefix(projectName, 'saved-modules.json'),
    outputPath: OUTPUTS_JSON_FOLDER,
    transformDataCallback,
    withAppend: true,
  });
};

export const updateSavedModulesFinishStatus = ({ projectName }: BaseArgs) => {
  const fileName = getFileNameWithPrefix(projectName, 'saved-modules.json');
  const savedModules = getSavedModules(projectName);

  const walletsWithModules = prepareSavedWalletsWithModules(savedModules);

  if (walletsWithModules) {
    printResults<SavedModules>({
      data: JSON.stringify(
        {
          isFinished: !walletsWithModules.length,
          walletsWithModules,
          route: savedModules.route,
        },
        null,
        2
      ),
      fileName,
      outputPath: OUTPUTS_JSON_FOLDER,
    });
  }
};

export const getSavedModules = (projectName: string): SavedModules => {
  const fileName = getFileNameWithPrefix(projectName, 'saved-modules.json');
  const filePath = `${OUTPUTS_JSON_FOLDER}${sep}${fileName}`;
  const savedModulesJson = readFileSync(filePath, 'utf-8');

  const savedModules = JSON.parse(savedModulesJson) as SavedModules;

  const walletsFileName = getFileNameWithPrefix(projectName, 'wallets.json');
  const walletsPath = `${OUTPUTS_JSON_FOLDER}${sep}${walletsFileName}`;
  const walletsJson = readFileSync(walletsPath, 'utf-8');
  const wallets = JSON.parse(walletsJson) as WalletData[];

  const walletsWithModules =
    savedModules.walletsWithModules?.map((walletWithModules) => {
      const walletId = walletWithModules.wallet.id;
      const walletIndex = walletWithModules.wallet.index;

      const currentWallet = wallets.find(({ id, index }) => id === walletId && index === walletIndex);
      if (currentWallet) {
        return {
          ...walletWithModules,
          wallet: {
            ...walletWithModules.wallet,
            ...currentWallet,
          },
        };
      }

      return walletWithModules;
    }) || [];

  return {
    ...savedModules,
    walletsWithModules,
  };
};
