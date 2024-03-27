import { OKX } from '../../_inputs/settings';
import { TransactionCallbackParams, TransactionCallbackReturn, transactionWorker } from '../../helpers';
import { Okx, OkxApiSecrets } from '../../managers/okx';
import { TransformedModuleParams } from '../../types';

export const execOkxCollect = async (params: TransformedModuleParams) =>
  transactionWorker({
    ...params,
    startLogMessage: 'Execute make OKX collect...',
    transactionCallback: makeOkxCollect,
  });

interface OkxAccount extends OkxApiSecrets {
  name: string;
}
const makeOkxCollect = async (props: TransactionCallbackParams): TransactionCallbackReturn => {
  const { logger, okxAccounts, okxCollectTokens } = props;

  const allOkxAccounts = Object.entries(OKX.accounts).reduce<OkxAccount[]>((acc, [name, settings]) => {
    if (!!settings.secret && !!settings.apiKey && !!settings.password) {
      return [
        ...acc,
        {
          name,
          ...settings,
        },
      ];
    }
    return acc;
  }, []);

  let currentOkxAccounts: OkxAccount[] = [];
  if (okxAccounts !== 'all') {
    for (const accountName of okxAccounts) {
      const foundOkxAccount = allOkxAccounts.find(({ name }) => name === accountName);

      if (foundOkxAccount) {
        currentOkxAccounts.push(foundOkxAccount);
      }
    }
  } else {
    currentOkxAccounts.push(...allOkxAccounts);
  }

  if (!currentOkxAccounts.length) {
    return {
      status: 'warning',
      message: 'No OKX accounts to work with. Probably provided accounts are incorrect',
    };
  }

  if (OKX.collectAccountName) {
    for (const okxAccount of currentOkxAccounts) {
      if (okxAccount.name === OKX.collectAccountName) {
        currentOkxAccounts = [
          ...currentOkxAccounts.filter((okxAccount) => okxAccount.name !== OKX.collectAccountName),
          okxAccount,
        ];
        break;
      }
    }
  }

  for (const okxAccount of currentOkxAccounts) {
    const { name, ...secrets } = okxAccount;

    logger.info(`Processing ${name} account...`);
    const okx = new Okx({
      logger,
      secrets,
    });

    await okx.transferFromSubAccs(okxCollectTokens);
    await okx.transferFromTradingAcc(okxCollectTokens);

    const balances = await okx.getMainAccountBalances();

    if (balances.length) {
      logger.success(`Balance of ${name}: ${balances.map(({ bal, ccy }: any) => `${ccy}=${(+bal).toFixed(5)}`)}`);
    }

    if (okxAccount.name !== OKX.collectAccountName && OKX.collectAccountEmail) {
      await okx.transferToAnotherAcc(OKX.collectAccountEmail, okxCollectTokens);
    }
  }

  return {
    status: 'success',
  };
};
