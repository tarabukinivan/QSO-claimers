import crypto from 'crypto';

import axios, { AxiosError } from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Hex } from 'viem';

import { BITGET } from '../../_inputs/settings';
import { defaultTokenAbi } from '../../clients/abi';
import { BITGET_KEYS_ERROR, WAIT_TOKENS } from '../../constants';
import {
  calculateAmount,
  ClientType,
  createProxyAgent,
  decimalToInt,
  getAxiosConfig,
  getLogMsgWalletToppedUp,
  getRandomNumber,
  getTokenContract,
  getTrimmedLogsAmount,
  intToDecimal,
  prepareProxy,
  showLogMakeWithdraw,
  sleep,
} from '../../helpers';
import type { LoggerType } from '../../logger';
import { ProxyAgent, SupportedNetworks, Tokens } from '../../types';
import { API_URL } from './constants';
import {
  BitgetConstructor,
  BitgetDeposit,
  BitgetTransferFromAccsToMain,
  BitgetWithdraw,
  GetAssets,
  MakeRequest,
  SubAccTransfer,
  Withdraw,
} from './types';

dayjs.extend(utc);

export const getQueryString = (obj: object) => {
  const sortedObj = Object.entries(obj)
    .filter(([_, value]) => {
      return value !== undefined && value !== null;
    })
    .sort();

  const params = new URLSearchParams(sortedObj).toString();

  return params ? '?' + params : '';
};

// Singleton
export class Bitget {
  private readonly logger: LoggerType;
  private readonly client?: ClientType;
  private readonly network?: SupportedNetworks;
  private proxyAgent?: ProxyAgent;
  private readonly hideExtraLogs?: boolean;

  constructor({ logger, client, network, hideExtraLogs }: BitgetConstructor) {
    this.logger = logger;
    this.client = client;
    this.network = network;
    this.hideExtraLogs = hideExtraLogs;
    if (BITGET.proxy) {
      const proxyObject = prepareProxy({
        proxy: BITGET.proxy,
      });
      const proxyAgent = createProxyAgent(proxyObject?.url);

      if (proxyAgent) {
        this.proxyAgent = proxyAgent;
      }
    }
  }

  public async getTokenBalance(token: Tokens) {
    const assets = await this.getAssets({
      coin: token,
    });

    return +assets[0]?.available || 0;
  }

  public async makeWithdraw(props: BitgetWithdraw): Promise<void | { passedMessage: string }> {
    const { token, amount, waitSleep } = props;

    if (!this.network || !this.client) {
      throw new Error('Network was not provided');
    }

    const isNativeToken = token === this.client.chainData.nativeCurrency.symbol;
    const tokenContract = getTokenContract({
      tokenName: token,
      network: this.network,
    }).address;

    const tokenContractInfo = isNativeToken
      ? undefined
      : {
          name: token,
          address: tokenContract,
          abi: defaultTokenAbi,
        };

    const { int: prevBalance } = await this.client.getNativeOrContractBalance(isNativeToken, tokenContractInfo);

    showLogMakeWithdraw({
      logger: this.logger,
      token,
      amount,
      network: this.network,
      cex: 'Bitget',
    });

    const params: Withdraw = {
      network: this.network,
      coin: token,
      transferType: 'on_chain',
      address: this.client.walletAddress,
      size: +amount.toFixed(7),
    };

    try {
      await this.withdraw(params);

      const currentSleep = waitSleep ? getRandomNumber(waitSleep) : 60;

      await sleep(currentSleep);

      let currentBalance = await this.client.getNativeOrContractBalance(isNativeToken, tokenContractInfo);
      while (!(currentBalance.int > prevBalance)) {
        currentBalance = await this.client.getNativeOrContractBalance(isNativeToken, tokenContractInfo);

        this.logger.info(WAIT_TOKENS);

        await sleep(currentSleep);
      }

      this.logger.success(
        getLogMsgWalletToppedUp({
          cex: 'Bitget',
          balance: currentBalance.int,
          token,
        })
      );
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const code = err.response?.data?.code || err.code || 0;

        if (+code === 47003) {
          await sleep(5);

          return this.withdraw({
            ...params,
            address: this.client.walletAddress.toLowerCase(),
          });
        }

        if (err.response?.data?.msg.includes('The 0USDT received in the red envelope can be withdraw within')) {
          throw new Error('temporarily frozen to withdraw');
        }
      }

      throw err;
    }
  }
  public async makeDeposit({
    token,
    minAndMaxAmount,
    minAmount,
    usePercentBalance,
    toAddress,
    client,
    gasOptions,
    balanceToLeft,
    minTokenBalance = 0,
  }: BitgetDeposit) {
    if (!this.network || !this.client) {
      throw new Error('Network was not provided');
    }

    const isNativeToken = token === this.client.chainData.nativeCurrency.symbol;
    const tokenContract = getTokenContract({
      tokenName: token,
      network: this.network,
    }).address;

    const tokenContractInfo = isNativeToken
      ? undefined
      : {
          name: token,
          address: tokenContract,
          abi: defaultTokenAbi,
        };

    const balance = await this.client.getNativeOrContractBalance(isNativeToken, tokenContractInfo);

    const logBalance = `${getTrimmedLogsAmount(balance.int, token)}`;

    if (balance.int <= minTokenBalance) {
      return {
        passedMessage: `Balance [${logBalance}] in [${this.network}] network is lower than minimum [${minTokenBalance} ${token}]`,
      };
    }

    let amountWei = calculateAmount({
      balance: balance.wei,
      minAndMaxAmount,
      usePercentBalance,
      decimals: balance.decimals,
      isBigInt: true,
    });
    if (balanceToLeft && balanceToLeft[0] && balanceToLeft[1]) {
      const balanceToLeftInt = getRandomNumber(balanceToLeft);

      const balanceToLeftWei = intToDecimal({
        amount: balanceToLeftInt,
        decimals: balance.decimals,
      });

      amountWei = balance.wei - balanceToLeftWei;

      if (balance.int - balanceToLeftInt <= 0) {
        return {
          status: 'warning',
          message: `Balance is ${getTrimmedLogsAmount(
            balance.int,
            token
          )}  that is lower than balance to left ${getTrimmedLogsAmount(balanceToLeftInt, token)}`,
        };
      }
    }

    const amountInt = decimalToInt({
      amount: amountWei,
      decimals: balance.decimals,
    });
    const logAmount = `${getTrimmedLogsAmount(amountInt, token)}`;

    if (minAmount && amountInt < minAmount) {
      return {
        error: `Calculated amount [${logAmount}] for [${this.network}] network is lower than provided minAmount [${minAmount}]`,
      };
    }

    if (amountInt > balance.int) {
      return {
        error: `Calculated amount [${logAmount}] is bigger than balance [${logBalance}] in [${this.network}] network`,
      };
    }

    this.logger.info(`Depositing [${logAmount}] to [${toAddress}] in [${this.network}]...`);

    const subAccountAssets = await this.getSubAccAssets();

    let prevBalances: Record<string, number> = {};
    for (const subAcc of subAccountAssets) {
      for (const asset of subAcc.assetsList) {
        if (token === asset.coin) {
          const amount = asset.available;
          const subAccUserId = subAcc.userId;

          prevBalances = {
            ...prevBalances,
            [subAccUserId]: +amount,
          };
        }
      }
    }

    let txHash;
    if (isNativeToken) {
      txHash = await client.walletClient.sendTransaction({
        to: toAddress,
        value: amountWei,
        data: '0x',
        ...gasOptions,
      });
    } else {
      txHash = await client.walletClient.writeContract({
        address: tokenContract,
        abi: defaultTokenAbi,
        functionName: 'transfer',
        args: [toAddress as Hex, amountWei],
        ...gasOptions,
      });
    }

    await client.waitTxReceipt(txHash);

    const transaction = await client.publicClient.getTransactionReceipt({ hash: txHash });

    if (transaction.status === 'success') {
      return { txHash, tgMessage: `${this.network} | Deposited: ${logAmount}` };
    } else {
      throw new Error(`Transaction ${txHash} was rejected`);
    }
  }

  public async makeTransferFromSubsToMain({ tokens }: BitgetTransferFromAccsToMain) {
    const accountInfo = await this.getInfo();
    const userId = accountInfo.userId;

    const subAccountAssets = await this.getSubAccAssets();
    const isAllTokens = !tokens.length;

    for (const subAcc of subAccountAssets) {
      for (const asset of subAcc.assetsList) {
        const amount = +asset.available;
        const logAmount = `${getTrimmedLogsAmount(+amount, asset.coin as Tokens)}`;
        if (amount > 0 && (tokens.includes(asset.coin) || isAllTokens)) {
          const subAccUserId = subAcc.userId;

          this.logger.info(`Transferring [${logAmount}] from [${subAccUserId}] to main account...`);

          try {
            await this.subAccTransfer({
              fromType: 'spot',
              toType: 'spot',
              amount,
              coin: asset.coin,
              fromUserId: subAccUserId,
              toUserId: userId,
            });

            this.logger.success(`Transferred [${logAmount}] from [${subAccUserId}] to main account`);

            await sleep(1);
          } catch (err) {
            if (err instanceof AxiosError) {
              if ((err.response?.data?.msg || '').includes('Parameter amount error')) {
                this.logger.warning(`Amount [${logAmount}] is too low to make transfer`);
                continue;
              }

              if (
                (err.response?.data?.msg || '').includes('The 0USDT received in the red envelope can be transferred')
              ) {
                this.logger.warning(`Amount [${logAmount}] is frozen`);
                continue;
              }
            }

            throw err;
          }
        }
      }
    }
  }

  // REQUESTS
  private async getSubAccAssets() {
    return this.makeRequest({
      method: 'GET',
      requestPath: '/spot/account/subaccount-assets',
    });
  }
  private async subAccTransfer(body: SubAccTransfer) {
    return this.makeRequest({
      method: 'POST',
      requestPath: '/spot/wallet/subaccount-transfer',
      body,
    });
  }
  private async getInfo() {
    return this.makeRequest({
      method: 'GET',
      requestPath: '/spot/account/info',
    });
  }
  private async getAssets(props?: GetAssets) {
    return this.makeRequest({
      method: 'GET',
      requestPath: '/spot/account/assets',
      params: props,
    });
  }
  private async withdraw({ network, ...restProps }: Withdraw) {
    const body = {
      ...restProps,
      ...(!!network && { chain: this.getCorrectNetwork(network) }),
    };

    return this.makeRequest({
      method: 'POST',
      requestPath: '/spot/wallet/withdrawal',
      body,
    });
  }

  private async makeRequest({ method, requestPath, body, params = {}, version = 2 }: MakeRequest) {
    this.keysGuard();

    const path = method === 'GET' ? requestPath + getQueryString(params) : requestPath;
    const timestamp = dayjs().utc().valueOf();

    const versionPath = version === 2 ? '/v2' : '/';
    const dataToSend = body ? JSON.stringify(body) : '';
    const hash = `${timestamp}` + method + `/api${versionPath}` + path + dataToSend;
    const hmac = crypto.createHmac('sha256', BITGET.secret);
    hmac.update(hash);
    const sign = hmac.digest('base64');

    const headers = {
      'Content-Type': 'application/json',
      'ACCESS-KEY': BITGET.apiKey,
      'ACCESS-PASSPHRASE': BITGET.passphrase,
      'ACCESS-SIGN': sign,
      'ACCESS-TIMESTAMP': `${timestamp}`,
      locale: 'en-US',
    };

    const config = await getAxiosConfig({ headers, proxyAgent: this.proxyAgent });
    const { data } = await axios({
      method,
      url: `${API_URL}${versionPath}` + path,
      ...(!!body && { data: body }),
      ...config,
    });

    return data?.data ? data.data : data;
  }

  // UTILS
  private getCorrectNetwork(network: SupportedNetworks) {
    switch (network) {
      case 'bsc':
        return 'BEP20';
      case 'core':
        return 'COREDAO';
      case 'eth':
        return 'ERC20';
      case 'arbitrum':
        return 'ARBITRUMONE';
      case 'zkSync':
        return 'zkSyncEra';
      case 'avalanche':
        return 'C-Chain';

      default:
        return network.toUpperCase();
    }
  }

  private keysGuard() {
    if (!BITGET.apiKey || !BITGET.secret || !BITGET.passphrase) {
      throw new Error(BITGET_KEYS_ERROR);
    }
  }
}
