import { bsc } from 'viem/chains';

import { BNB_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { BnbTokens, Networks } from '../types';
import { DefaultClient } from './default-client';

export class BscClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, bsc, logger, Networks.BSC);
  }

  async getBalanceByToken(tokenName: BnbTokens) {
    const contractInfo = getTokenContract({
      contracts: BNB_TOKEN_CONTRACTS,
      tokenName,
    });

    return this.getBalanceByContract(contractInfo);
  }
}

export type IBscClient = BscClient;
