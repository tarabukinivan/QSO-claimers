import { sep } from 'path';

import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

import { INPUTS_CSV_FOLDER } from '../../constants';
import { LoggerType } from '../../logger';
import {
  JsonProxyObject,
  OptionalPreparedProxyData,
  OptionalProxyObject,
  PreparedProxyData,
  ProxyAgent,
} from '../../types';
import { convertAndWriteToJSON } from '../file-handlers';
import { getAxiosConfig } from './get-axios-config';
import { getRandomItemFromArray } from './randomizers';

const MY_IP_API_URL = 'https://api.myip.com';

export const createProxyAgent = (proxy = '', logger?: LoggerType): ProxyAgent | null => {
  try {
    let proxyAgent = null;

    if (proxy) {
      if (proxy.includes('http')) {
        proxyAgent = new HttpsProxyAgent(proxy);
      }

      if (proxy.includes('socks')) {
        proxyAgent = new SocksProxyAgent(proxy);
      }
    }

    return proxyAgent;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Invalid URL')) {
      logger?.error('You use incorrect proxy format, it should be login:pass@ip:port');
    } else {
      const error = err as Error;
      logger?.error(`Unable to create proxy agent: ${error.message}`);
    }
  }

  return null;
};

export const getRandomProxy = async (logger?: LoggerType) => {
  const inputPath = `${INPUTS_CSV_FOLDER}${sep}proxies.csv`;

  const proxies = (await convertAndWriteToJSON({
    inputPath,
    logger,
  })) as JsonProxyObject[];

  const randomProxy = getRandomItemFromArray(proxies);

  if (randomProxy) {
    return prepareProxy(randomProxy);
  }

  return;
};

export const prepareProxy = (proxy: JsonProxyObject, logger?: LoggerType): OptionalPreparedProxyData => {
  try {
    if (!proxy.proxy) {
      return;
    }

    const incorrectProxyFormat = 'You use incorrect proxy format or didnt add proxy type';

    const isIncorrectProxy =
      !proxy.proxy_type ||
      proxy.proxy.startsWith('http://') ||
      proxy.proxy.startsWith('https://') ||
      proxy.proxy.startsWith('http://');
    if (isIncorrectProxy) {
      logger?.error(incorrectProxyFormat);
      return;
    }

    const [login, ...rest] = proxy.proxy.split(':');
    const restProxyData = rest.join(':');
    if (!login) {
      logger?.error(incorrectProxyFormat);
      return;
    }

    const [pass, ipAndPort] = restProxyData.split('@');
    if (!pass || !ipAndPort) {
      logger?.error(incorrectProxyFormat);
      return;
    }

    const [ip, port] = ipAndPort.split(':');
    if (!ip || !port) {
      logger?.error(incorrectProxyFormat);
      return;
    }

    return {
      url: `${proxy.proxy_type.toLowerCase()}://${proxy.proxy}`,
      proxyType: proxy.proxy_type,
      proxyIp: ip,
      proxyPort: port,
      proxyLogin: login,
      proxyPass: pass,
    };
  } catch (err) {
    const error = err as Error;
    logger?.error(`Unable to prepare proxy: ${error.message}`);
    return;
  }
};

export const prepareProxyAgent = async (
  proxyData: PreparedProxyData,
  logger?: LoggerType
): Promise<OptionalProxyObject> => {
  const { url, ...restProxyData } = proxyData;

  const proxyAgent = createProxyAgent(url, logger);

  if (proxyAgent) {
    // show current IP address
    if (logger) {
      try {
        const config = await getAxiosConfig({
          proxyAgent,
        });
        const response = await axios.get(MY_IP_API_URL, config);

        const data = response?.data;

        if (data && !data.error) {
          logger.info(`Current IP: ${data?.ip} | ${data?.country}`);
        } else {
          logger?.warning(`Unable to check current IP: ${data?.error}. Dont worry, proxy is still in use`);
        }
      } catch (err) {
        const error = err as Error;
        logger?.warning(`Unable to check current IP: ${error.message}. Dont worry, proxy is still in use`);
      }
    }

    return {
      proxyAgent,
      ...restProxyData,
    };
  }

  return null;
};

export const getProxyAgent = async (proxy: JsonProxyObject, logger?: LoggerType): Promise<OptionalProxyObject> => {
  const preparedProxyData = prepareProxy(proxy, logger);

  if (preparedProxyData) {
    return prepareProxyAgent(preparedProxyData, logger);
  }

  return null;
};

export const createRandomProxyAgent = async (logger?: LoggerType): Promise<OptionalProxyObject> => {
  const proxy = await getRandomProxy();

  if (proxy) {
    return prepareProxyAgent(proxy, logger);
  }

  return null;
};
