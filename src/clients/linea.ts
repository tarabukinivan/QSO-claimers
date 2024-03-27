import { linea } from 'viem/chains';

import { LINEA_TOKEN_CONTRACTS } from '../constants';
import { getTokenContract } from '../helpers';
import { LoggerType } from '../logger';
import { LineaTokens, Networks } from '../types';
import { DefaultClient } from './default-client';

export class LineaClient extends DefaultClient {
  constructor(privateKey: string, logger: LoggerType) {
    super(privateKey, linea, logger, Networks.LINEA);
  }

  async getBalanceByToken(tokenName: LineaTokens) {
    const contractInfo = getTokenContract({ contracts: LINEA_TOKEN_CONTRACTS, tokenName });
    return this.getBalanceByContract(contractInfo);
  }
}

export type ILineaClient = LineaClient;
