import { arbitrum } from 'viem/chains';

import { ARBITRUM_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { ArbitrumTokens, Networks } from '../types';
import { DefaultClient } from './default-client';

export class ArbitrumClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, arbitrum, logger, Networks.ARBITRUM);
  }

  async getBalanceByToken(tokenName: ArbitrumTokens) {
    const contractInfo = getTokenContract({
      contracts: ARBITRUM_TOKEN_CONTRACTS,
      tokenName,
    });
    return this.getBalanceByContract(contractInfo);
  }
}

export type IArbitrumClient = ArbitrumClient;
