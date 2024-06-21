import uniqBy from 'lodash/uniqBy';
import { DataSource } from 'typeorm';

import { CHECKERS_FOLDER } from '../../../constants';
import { convertToCsvAndWrite, DataForCsv } from '../../../helpers';
import { WalletData, WalletWithModules } from '../../../types';
import { LayerZeroClaimEntity, PolyhedraClaimEntity } from '../db/entities';

interface SaveResultsFromDb {
  projectName: string;
  dbSource: DataSource;
  walletsWithModules: WalletWithModules[];
}
export const saveResultsFromDb = async ({ dbSource, projectName, walletsWithModules }: SaveResultsFromDb) => {
  const wallets = walletsWithModules.reduce<WalletData[]>((acc, cur) => {
    const wallet = cur.wallet;

    const moduleWithUpdate = cur.modules.find(
      ({ moduleName }) =>
        moduleName === `${projectName}-check-claim` ||
        moduleName === `${projectName}-claim` ||
        moduleName === `${projectName}-transfer-claim`
    );
    if (moduleWithUpdate) {
      return [...acc, wallet];
    }

    return acc;
  }, []);

  let projectEntity;
  switch (projectName) {
    case 'layer-zero':
      projectEntity = LayerZeroClaimEntity;
      break;

    default:
      projectEntity = PolyhedraClaimEntity;
  }

  if (wallets.length) {
    const dbRepo = dbSource.getRepository(projectEntity);
    const dbData = await dbRepo.find({
      order: {
        walletId: 'ASC',
      },
      take: 10000,
    });

    const dataToSave = dbData.reduce<object[]>((acc, cur) => {
      const { walletId, index: walletIndex, id, ...data } = cur;
      const foundWallet = wallets.find(({ id, index }) => walletId === id && index === walletIndex);

      if (foundWallet) {
        return [
          ...acc,
          {
            id: walletId,
            ...data,
          },
        ];
      }
      return acc;
    }, []);

    const uniqueDataToSave = uniqBy(dataToSave, 'id');
    convertToCsvAndWrite({
      data: uniqueDataToSave as DataForCsv,
      fileName: `${projectName}-claim.csv`,
      outputPath: CHECKERS_FOLDER,
    });
  }
};
