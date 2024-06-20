import { layerZero, polyhedra } from '../../../_inputs/settings/routes';
import { Route } from '../../../types';

export const routeHandler = (route: Route) => {
  switch (route) {
    case 'polyhedra':
      return polyhedra;
    case 'layer-zero':
      return layerZero;

    default:
      throw new Error('Route name is wrong');
  }
};
