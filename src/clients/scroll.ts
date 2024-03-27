import { scroll } from 'viem/chains';

import { SCROLL_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { Networks, ScrollTokens } from '../types';
import { DefaultClient } from './default-client';

export class ScrollClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, scroll, logger, Networks.SCROLL);
  }

  async getBalanceByToken(tokenName: ScrollTokens) {
    const contractInfo = getTokenContract({
      contracts: SCROLL_TOKEN_CONTRACTS,
      tokenName,
    });
    return this.getBalanceByContract(contractInfo);
  }
}

export type IScrollClient = ScrollClient;
