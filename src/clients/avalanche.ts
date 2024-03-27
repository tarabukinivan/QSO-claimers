import { avalanche } from 'viem/chains';

import { AVALANCHE_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { AvalancheTokens, Networks } from '../types';
import { DefaultClient } from './default-client';

export class AvalancheClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, avalanche, logger, Networks.AVALANCHE);
  }

  async getBalanceByToken(tokenName: AvalancheTokens) {
    const contractInfo = getTokenContract({
      contracts: AVALANCHE_TOKEN_CONTRACTS,
      tokenName,
    });
    return this.getBalanceByContract(contractInfo);
  }
}

export type IAvalancheClient = AvalancheClient;
