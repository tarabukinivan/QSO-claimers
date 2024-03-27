import { base } from 'viem/chains';

import { BASE_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { BaseTokens, Networks } from '../types';
import { DefaultClient } from './default-client';

export class BaseClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, base, logger, Networks.BASE);
  }

  async getBalanceByToken(tokenName: BaseTokens) {
    const contractInfo = getTokenContract({ contracts: BASE_TOKEN_CONTRACTS, tokenName });
    return this.getBalanceByContract(contractInfo);
  }
}

export type IBaseClient = BaseClient;
