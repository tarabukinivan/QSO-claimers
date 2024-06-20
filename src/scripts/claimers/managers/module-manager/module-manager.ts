import { IModuleManager, ModuleManager as DefaultModuleManager } from '../../../../managers/module-manager';
import { ModuleNames } from '../../../../types';
import {
  execMakeCheckClaimPolyhedra,
  execMakeClaimLayerZero,
  execMakeClaimPolyhedra,
  execMakeTransferClaimLayerZero,
  execMakeTransferClaimPolyhedra,
} from '../../modules';

export class ModuleManager extends DefaultModuleManager {
  constructor(args: IModuleManager) {
    super(args);
  }

  findModule(moduleName: ModuleNames) {
    switch (moduleName) {
      case 'polyhedra-claim':
        return execMakeClaimPolyhedra;
      case 'polyhedra-check-claim':
        return execMakeCheckClaimPolyhedra;
      case 'polyhedra-transfer-claim':
        return execMakeTransferClaimPolyhedra;

      case 'layerZero-claim':
        return execMakeClaimLayerZero;
      case 'layerZero-transfer-claim':
        return execMakeTransferClaimLayerZero;

      default:
        return;
    }
  }
}
