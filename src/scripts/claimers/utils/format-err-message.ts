import { AxiosError } from 'axios';
import { TransactionExecutionError } from 'viem';

export const formatErrMessage = (err: unknown) => {
  let errorMessage = (err as Error).message;

  if (err instanceof AxiosError) {
    errorMessage =
      err.response?.data.msg ||
      err.response?.data.message ||
      err.response?.data.error ||
      err.response?.data.error?.message ||
      err.response?.data.error?.msg ||
      err.response?.data.errors?.[0]?.message ||
      err.response?.data.errors?.[0]?.msg ||
      errorMessage;
  }

  if (err instanceof TransactionExecutionError) {
    errorMessage = err.shortMessage;
  }

  if (errorMessage.includes('Details: {')) {
    errorMessage = errorMessage.split('"message":"')[1]?.split('"')[0] || errorMessage;
  }

  return errorMessage.replace(',', '').slice(0, 999);
};
