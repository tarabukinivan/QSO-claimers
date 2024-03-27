import yargs from 'yargs';

import { EthClient } from '../../clients';
import { restartLast } from '../../helpers/main/restart-last';
import { BASE_NETWORK } from './constants';
import { buildLocalFolderName } from './logger';
import { startModulesCallback } from './utils';

const slicedArgv = process.argv.slice(2);
const argv = await yargs().demandCommand(2, 'Not all args provided').parse(slicedArgv);
const [_, projectNameArg] = argv._;

(async () => {
  const projectName = `${projectNameArg}` || '';
  const logsFolderName = buildLocalFolderName(projectName);

  await restartLast({
    logsFolderName,
    startModulesCallback,
    clientToPrepareWallets: EthClient,
    baseNetwork: BASE_NETWORK,
    projectName: `${projectName}` || '',
  });
})();
