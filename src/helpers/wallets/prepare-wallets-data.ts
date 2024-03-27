import { sep } from 'path';

import { INPUTS_CSV_FOLDER, NUMBER_ONLY_REGEXP, OUTPUTS_JSON_FOLDER } from '../../constants';
import { LoggerData } from '../../logger';
import { WalletData } from '../../types';
import { decryptKey, encryptKey } from '../cryptography-handlers';
import { convertAndWriteToJSON, convertToCSV, DataForCsv, printResults } from '../file-handlers';
import { getFileNameWithPrefix } from '../msg-to-template';
import { initLocalLogger } from '../show-logs';
import { PrepareFromCsvArgs, PrepareRowFromCsvArgs, PrepareWalletsData } from './types';

const PRIV_KEY_LENGTH = 70;

export const formatId = (inputString: string): string => {
  const parts: string[] = inputString.split(NUMBER_ONLY_REGEXP);

  const isNumberPartCorrect = !isNaN(Number(parts[0]));
  const isPartsSplittedCorrectly = parts.length >= 1 && isNumberPartCorrect;

  if (isPartsSplittedCorrectly) {
    const numberPart: number = Number(parts[0]);
    const formattedNumberPart: string = numberPart.toString().padStart(4, '0');
    const namePart = parts.slice(1).join('').trim();

    return `${formattedNumberPart}${namePart ? ' ' + namePart : ''}`;
  }

  return '';
};

export const prepareRowFromCSV = ({ walletData, logger, client }: PrepareRowFromCsvArgs) => {
  // const logTemplate: LoggerData = {
  //   action: 'prepareRowFromCSV',
  //   status: 'in progress',
  // };

  const { id, privKey, ...restRow } = walletData;
  // logger.setLoggerMeta({ id });
  // logger.info('Preparing next wallet from csv...', {
  //   ...logTemplate,
  //   status: 'in progress',
  // });

  let decryptedPrivKey = privKey;
  // PrivKey already was encrypted last time and we need to decrypt that to get wallet address
  if (privKey.length > PRIV_KEY_LENGTH) {
    decryptedPrivKey = decryptKey(privKey);
  }

  const { walletAddress } = new client(decryptedPrivKey, logger);

  return {
    ...restRow,
    privKey,
    id: formatId(id),
    walletAddress,
  };
};

export const prepareFromCsv = async ({ logger, projectName, client }: PrepareFromCsvArgs) => {
  const fileName = getFileNameWithPrefix(projectName, 'wallets');
  const logTemplate: LoggerData = {
    action: 'prepareFromCsv',
    status: 'in progress',
  };

  try {
    logger.info(`Preparing data from ${fileName}.csv...`, logTemplate);

    const inputName = `${fileName}.csv`;
    const inputPath = `${INPUTS_CSV_FOLDER}${sep}${inputName}`;
    const outputName = `${fileName}.json`;
    const outputPath = `${OUTPUTS_JSON_FOLDER}${sep}${outputName}`;

    const data = (await convertAndWriteToJSON({
      inputPath,
      outputPath,
      logger,
      withSaving: true,
    })) as WalletData[];

    const idOrPrivKeyIsEmpty = data.some(({ id, privKey }) => !id || !privKey);

    if (idOrPrivKeyIsEmpty) {
      logger.error('Unable to create rows, some ID or PrivKey is empty', {
        ...logTemplate,
        status: 'failed',
      });

      return;
    }

    const dataToSave: WalletData[] = data.map((walletData) => prepareRowFromCSV({ client, walletData, logger }));

    if (dataToSave.length !== data.length) {
      logger.error('Unable to prepare all data correctly', {
        ...logTemplate,
        status: 'failed',
      });

      return;
    }

    const dataToSaveInCsv: WalletData[] = dataToSave.map(
      ({ id, walletAddress, privKey, okxAddress, secondAddress, proxy_type, proxy }) => {
        let encryptedPrivKey = privKey;

        // We need to encrypt privKey to push into csv and json
        if (privKey.length <= PRIV_KEY_LENGTH) {
          encryptedPrivKey = encryptKey(privKey);
        }

        return {
          id,
          walletAddress,
          privKey: encryptedPrivKey,
          okxAddress,
          secondAddress,
          proxy_type,
          proxy,
        };
      }
    );

    const dataToSaveInJson = dataToSaveInCsv.map((data, index) => ({
      ...data,
      index,
    }));
    const stringifiedDataForJson = JSON.stringify(dataToSaveInJson, null, 2);
    printResults({ data: stringifiedDataForJson, fileName: outputName, outputPath: OUTPUTS_JSON_FOLDER });

    if (dataToSaveInCsv.length) {
      const csvStringData = convertToCSV(dataToSaveInCsv as unknown as DataForCsv);
      printResults({ data: csvStringData, fileName: inputName, outputPath: INPUTS_CSV_FOLDER });
    }

    return dataToSaveInJson;
  } catch (err) {
    const e = err as Error;
    let errorMessage = e.message;

    if (
      errorMessage.includes('private key must be 32 bytes, hex or bigint') ||
      errorMessage.includes('Malformed UTF-8 data')
    ) {
      errorMessage = 'Some private key or secret phrase is wrong';
    }

    logger.error(`Unable to prepare data from CSV: \n${errorMessage}`, {
      ...logTemplate,
      status: 'failed',
    });
  }

  return;
};

export const prepareWalletsData = async ({
  logsFolderName,
  ...restProps
}: PrepareWalletsData): Promise<WalletData[]> => {
  const logger = initLocalLogger(logsFolderName, 'prepare-wallets-data');
  logger.setLoggerMeta({ moduleName: 'PrepareWalletsData' });
  const logTemplate: LoggerData = {
    action: 'prepareWalletsData',
    status: 'in progress',
  };

  try {
    return (
      (await prepareFromCsv({
        logger,
        ...restProps,
      })) || []
    );
  } catch (err) {
    logger.error('Unable to prepare wallets data', { ...logTemplate, status: 'failed' });
  }
  return [];
};
