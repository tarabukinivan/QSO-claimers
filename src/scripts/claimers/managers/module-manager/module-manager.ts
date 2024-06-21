import { IModuleManager, ModuleManager as DefaultModuleManager } from '../../../../managers/module-manager';
import { ModuleNames } from '../../../../types';
import {
  execMakeCheckClaimPolyhedra,
  execMakeClaimLayerZero,
  execMakeClaimPolyhedra,
  execMakeTransferClaimLayerZero,
  execMakeTransferClaimPolyhedra,
} from '../../modules';
import { execMakeCheckClaimLayerZero } from '../../modules/layer-zero/make-check-claim';

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

      case 'layer-zero-check-claim':
        return execMakeCheckClaimLayerZero;
      case 'layer-zero-claim':
        return execMakeClaimLayerZero;
      case 'layer-zero-transfer-claim':
        return execMakeTransferClaimLayerZero;

      default:
        return;
    }
  }
}
