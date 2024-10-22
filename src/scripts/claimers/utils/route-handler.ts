import { layerZero, polyhedra, taiko, scroll } from '../../../_inputs/settings/routes';
import { Route } from '../../../types';

export const routeHandler = (route: Route) => {
  switch (route) {
    case 'polyhedra':
      return polyhedra;
    case 'layer-zero':
      return layerZero;
    case 'taiko':
      return taiko;
    case 'scroll':
      return scroll;

    default:
      throw new Error('Route name is wrong');
  }
};
