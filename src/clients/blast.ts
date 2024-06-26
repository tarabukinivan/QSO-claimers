import { blast } from 'viem/chains';

import { BLAST_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { BlastTokens, Networks } from '../types';
import { DefaultClient } from './default-client';

export class BlastClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, blast, logger, Networks.BLAST);
  }

  async getBalanceByToken(tokenName: BlastTokens) {
    const contractInfo = getTokenContract({ contracts: BLAST_TOKEN_CONTRACTS, tokenName });
    return this.getBalanceByContract(contractInfo);
  }
}
