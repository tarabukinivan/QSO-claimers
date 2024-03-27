import { coreDao } from 'viem/chains';

import { EVM_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { EvmTokens, Networks } from '../types';
import { DefaultClient } from './default-client';

export class CoreClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, coreDao, logger, Networks.CORE);
  }

  async getBalanceByToken(tokenName: EvmTokens) {
    const contractInfo = getTokenContract({ contracts: EVM_TOKEN_CONTRACTS, tokenName });
    return this.getBalanceByContract(contractInfo);
  }
}

export type ICoreClient = CoreClient;
