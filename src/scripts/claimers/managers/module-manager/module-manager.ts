import { IModuleManager, ModuleManager as DefaultModuleManager } from '../../../../managers/module-manager';
import { ModuleNames } from '../../../../types';
import {
  execMakeCheckClaimPolyhedra,
  execMakeClaimLayerZero,
  execMakeClaimPolyhedra,
  execMakeClaimTaiko,
  execMakeTransferClaimLayerZero,
  execMakeTransferClaimPolyhedra,
  execMakeTransferClaimTaiko,
} from '../../modules';
import { execMakeCheckClaimLayerZero } from '../../modules/layer-zero/make-check-claim';
import { execMakeCheckClaimTaiko } from '../../modules/taiko/make-check-claim';

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

      case 'taiko-claim':
        return execMakeClaimTaiko;
      case 'taiko-check-claim':
        return execMakeCheckClaimTaiko;
      case 'taiko-transfer-claim':
        return execMakeTransferClaimTaiko;

      default:
        return;
    }
  }
}
