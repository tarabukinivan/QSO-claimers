// TODO: make manager

import Moralis from 'moralis';

import { MORALIS_KEY } from '../_inputs/settings';
import { LoggerType } from '../logger';

export const initMoralis = async (logger: LoggerType) => {
  try {
    if (!MORALIS_KEY) {
      throw new Error('Please provide MORALIS_KEY in global.js');
    }

    // TODO: create MORALIS manager
    await Moralis.start({
      apiKey: MORALIS_KEY,
    });

    await Moralis.EvmApi.marketData.getTopCryptoCurrenciesByMarketCap();
  } catch (e) {
    const invalidMoralisKeyMgs = 'MORALIS_KEY is invalid. Please provide correct one in global.js';

    let errMsg = (e as Error).message;

    if (errMsg.includes('Token is invalid format') || errMsg.includes('invalid signature')) {
      errMsg = invalidMoralisKeyMgs;
    }

    logger.error(errMsg);

    if (errMsg.includes('Modules are started already. This method should be called only one time.')) {
      return;
    } else {
      throw e;
    }
  }
};
