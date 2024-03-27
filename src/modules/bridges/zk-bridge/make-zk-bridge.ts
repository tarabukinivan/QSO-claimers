import { parseEther } from 'viem';

import { zkBridgeAbi } from '../../../clients/abi';
import { getRandomNumber, TransactionCallbackParams } from '../../../helpers';

export const makeZkSyncBridge = async (params: TransactionCallbackParams) => {
  const { client, minAndMaxAmount } = params;

  const amount = `${getRandomNumber(minAndMaxAmount)}`;

  const { walletClient, walletAddress, publicClient, explorerLink } = client;
  const constractAddress = '0x32400084C286CF3E17e7B677ea9583e60a000324';

  const gasPrice = await publicClient.getGasPrice();
  const gasLimit = getRandomNumber([700000, 1000000]);

  const amountForTx = (await publicClient.readContract({
    address: constractAddress,
    abi: zkBridgeAbi,
    functionName: 'l2TransactionBaseCost',
    args: [gasPrice, gasLimit, 800],
  })) as bigint;

  const value = BigInt(parseEther(amount)) + amountForTx;

  const txHash = await walletClient.writeContract({
    address: constractAddress,
    abi: zkBridgeAbi,
    functionName: 'requestL2Transaction',
    args: [walletAddress, parseEther(amount), '0x', gasLimit, 800, [], walletAddress],
    value,
  });

  await client.waitTxReceipt(txHash);

  return {
    txHash,
    explorerLink,
  };
};
