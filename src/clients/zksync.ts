import { zkSync } from 'viem/chains';

import { ZKSYNC_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { Networks, ZkSyncTokens } from '../types';
import { DefaultClient } from './default-client';

export class ZkSyncClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, zkSync, logger, Networks.ZKSYNC);
  }

  async getBalanceByToken(tokenName: ZkSyncTokens) {
    const contractInfo = getTokenContract({
      contracts: ZKSYNC_TOKEN_CONTRACTS,
      tokenName,
    });
    return this.getBalanceByContract(contractInfo);
  }
}

export type IZkSyncClient = ZkSyncClient;
