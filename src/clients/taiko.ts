import { taiko } from 'viem/chains';

import { TAIKO_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { Networks, TaikoTokens } from '../types';
import { DefaultClient } from './default-client';

export class TaikoClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, taiko, logger, Networks.TAIKO);
  }

  async getBalanceByToken(tokenName: TaikoTokens) {
    const contractInfo = getTokenContract({
      contracts: TAIKO_TOKEN_CONTRACTS,
      tokenName,
    });
    return this.getBalanceByContract(contractInfo);
  }
}
