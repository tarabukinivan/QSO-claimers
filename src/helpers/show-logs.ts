import { Logger, LoggerType } from '../logger';
import { Route, RouteSettings, TransformedModuleConfig } from '../types';

export const showLogSelectedModules = (routeSettings: RouteSettings, route: Route, logger: LoggerType) => {
  const moduleNames = routeSettings.modules.map(({ moduleName }) => moduleName);
  const selectedModules = moduleNames.join(',\n');

  logger.success(`Route [${route}] will be launched with [${selectedModules}] modules`);
};

export const showLogPreparedModules = (preparedModules: TransformedModuleConfig[], logger: LoggerType) => {
  const modules = preparedModules
    .reduce<string[]>((acc, cur) => {
      const {
        srcToken,
        destTokens,
        contractPairs,
        moduleName,
        contractAddresses,
        delay,
        projectAddresses,
        ...restProps
      } = cur;

      const swapsDataToSwow = contractPairs ? { contractPairs } : { srcToken, destTokens };
      const objectToShow = {
        ...restProps,
        ...swapsDataToSwow,
        ...(!!contractAddresses && { contractAddress: contractAddresses.length }),
        ...(!!projectAddresses && { projectAddresses: projectAddresses.length }),
        ...(!!delay &&
          !(delay[0] === 0 && delay[1] === 0) && {
            delay,
          }),
      };
      return [...acc, `--- ${moduleName}: ${JSON.stringify(objectToShow)}`];
    }, [])
    .join(',\n');

  logger.success(`Modules was prepared:\n${modules}`);
};

const buildFileName = (fileName: string) => {
  return `${fileName}.log`;
};

export const initLocalLogger = (folderName: string, fileName: string) =>
  new Logger(folderName, buildFileName(fileName));
