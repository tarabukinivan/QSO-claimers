import yargs from 'yargs';

import { EthClient } from '../../clients';
import { runMainScript } from '../../helpers';
import { Route } from '../../types';
import { BASE_NETWORK } from './constants';
import { buildLocalFolderName } from './logger';
import { routeHandler, startModulesCallback } from './utils';

const slicedArgv = process.argv.slice(2);
const argv = await yargs().demandCommand(3, 'Not all args provided').parse(slicedArgv);
const [_, projectNameArg, routes] = argv._;

(async () => {
  const projectName = `${projectNameArg}` || '';
  const logsFolderName = buildLocalFolderName(projectName);

  await runMainScript({
    logsFolderName,
    clientToPrepareWallets: EthClient,
    routeHandler,
    startModulesCallback,
    baseNetwork: BASE_NETWORK,
    projectName,
    routes: `${routes}`.split(', ') as Route[],
  });
})();
