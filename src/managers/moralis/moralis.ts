import { AxiosError } from 'axios';
import MoralisLib from 'moralis';

import { MORALIS_KEY } from '../../_inputs/settings';
import { getSpentGas, sleep } from '../../helpers';
import { LoggerType } from '../../logger';
import { GetTx, GetTxData, GetTxs, MoralisTx } from './types';

const apiKeyIdEmptyErr = 'apiKeyId should not be empty';
export class Moralis {
  async init(logger?: LoggerType) {
    try {
      if (!MORALIS_KEY) {
        throw new Error('Please provide MORALIS_KEY in global.js');
      }

      await MoralisLib.start({
        apiKey: MORALIS_KEY,
      });

      await MoralisLib.EvmApi.marketData.getTopCryptoCurrenciesByMarketCap();
    } catch (e) {
      const invalidMoralisKeyMgs = 'MORALIS_KEY is invalid. Please provide correct one in global.js';

      let errMsg = (e as Error).message;

      if (errMsg.includes('Token is invalid format') || errMsg.includes('invalid signature')) {
        errMsg = invalidMoralisKeyMgs;
      }

      logger?.error(errMsg);

      if (errMsg.includes('Modules are started already. This method should be called only one time.')) {
        return;
      } else {
        throw e;
      }
    }
  }

  async getTxs(params: GetTxs): Promise<MoralisTx[]> {
    const { chainId, walletAddress } = params;
    try {
      const txs = [];

      let cursor;
      let shouldStop = false;
      while (!shouldStop) {
        const response = await MoralisLib.EvmApi.transaction.getWalletTransactions({
          address: walletAddress,
          chain: chainId,
          cursor,
        });

        const result = response.toJSON();

        for (const tx of result.result) {
          txs.push(tx);
        }

        cursor = response.pagination.cursor;

        if (!cursor) {
          shouldStop = true;
        } else {
          await sleep(30);
        }
      }

      return txs as MoralisTx[];
    } catch (err) {
      let errMessage = (err as Error).message;

      if (errMessage.includes(apiKeyIdEmptyErr)) {
        this.init();
        await this.getTxs(params);
      }

      if (err instanceof AxiosError) {
        errMessage = err.response?.data.message || errMessage;
      }
      if (errMessage.includes('Not found')) return [];

      throw err;
    }
  }

  async getTx(params: GetTx): Promise<MoralisTx | undefined> {
    const { chainId, txHash } = params;

    try {
      const response = await MoralisLib.EvmApi.transaction.getTransaction({
        chain: chainId,
        transactionHash: txHash,
      });

      const result = response?.toJSON();

      if (!result) return;
      return result as MoralisTx;
    } catch (err) {
      let errMessage = (err as Error).message;

      if (errMessage.includes(apiKeyIdEmptyErr)) {
        this.init();
        await this.getTx(params);
      }

      if (err instanceof AxiosError) {
        errMessage = err.response?.data.message || errMessage;
      }

      if (errMessage.includes('Not found')) return;

      throw err;
    }
  }

  getTxData({ txs, method, to }: GetTxData) {
    return txs.find(({ input, to_address }) => {
      const toContractLc = to.toLowerCase();

      return input.startsWith(method) && to_address.toLowerCase() === toContractLc;
    });
  }

  getSpentGas(data?: MoralisTx) {
    return data ? getSpentGas(data.gas_price, data.receipt_gas_used) : 0;
  }
}
