import { polygon } from 'viem/chains';

import { POLYGON_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { Networks, PolygonTokens } from '../types';
import { DefaultClient } from './default-client';

export class PolygonClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, polygon, logger, Networks.POLYGON);
  }

  async getBalanceByToken(tokenName: PolygonTokens) {
    const contractInfo = getTokenContract({
      contracts: POLYGON_TOKEN_CONTRACTS,
      tokenName,
    });
    return this.getBalanceByContract(contractInfo);
  }
}

export type IPolygonClient = PolygonClient;
