import { zora } from 'viem/chains';

import { ZORA_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { Networks, ZoraTokens } from '../types';
import { DefaultClient } from './default-client';

export class ZoraClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, zora, logger, Networks.ZORA);
  }

  async getBalanceByToken(tokenName: ZoraTokens) {
    const contractInfo = getTokenContract({ contracts: ZORA_TOKEN_CONTRACTS, tokenName });
    return this.getBalanceByContract(contractInfo);
  }
}

export type IZoraClient = ZoraClient;
