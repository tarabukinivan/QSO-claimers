import { buildFolderName } from '../../../logger/utils';
import { LOGGER_PATH } from '../constants';

export const buildLocalFolderName = (projectName: string) => buildFolderName(LOGGER_PATH + projectName);
