import { AxiosError } from 'axios';
import { ContractFunctionExecutionError, EstimateGasExecutionError, TransactionExecutionError } from 'viem';

import {
  CRITICAL_ERRORS_MAP,
  NFT_HOLDING_ERROR,
  NOT_ENOUGH_FUNDS_FOR_FEE_ERROR,
  PASSED_ERROR_MAP,
  WARNING_ERRORS_MAP,
} from '../../constants';
import { SupportedNetworks } from '../../types';

export const getFormattedErrorMessage = (e: unknown, currentNetwork: SupportedNetworks) => {
  const error = e as Error;
  let errorMessage: string = error.message;

  if (e instanceof AxiosError) {
    errorMessage =
      e.response?.data.msg ||
      e.response?.data.message ||
      e.response?.data.error?.message ||
      e.response?.data.error?.msg ||
      e.response?.data.errors?.[0]?.message ||
      e.response?.data.errors?.[0]?.msg ||
      e.response?.data.error?.[0]?.message ||
      e.response?.data.error?.[0]?.msg ||
      e.response?.data.error ||
      errorMessage;
  }

  if (e instanceof TransactionExecutionError) {
    if (errorMessage.includes('gas required exceeds allowance')) {
      errorMessage = NOT_ENOUGH_FUNDS_FOR_FEE_ERROR;
    } else {
      errorMessage = `Unable to execute transaction: ${e.shortMessage}. ${e.details}`;
    }
  }
  if (e instanceof ContractFunctionExecutionError) {
    errorMessage = `Unable to execute transaction: ${e.shortMessage}. ${e.details}`;
  }
  if (e instanceof EstimateGasExecutionError) {
    errorMessage = `Unable to estimate gas: ${e.shortMessage}. ${e.details}`;
  }

  if (errorMessage.includes('Details: {')) {
    errorMessage = errorMessage.split('"message":"')[1]?.split('"')[0] || errorMessage;
  }

  const isNftHoldingError = errorMessage.includes(NFT_HOLDING_ERROR);

  if (errorMessage.includes('max fee per gas less than block base fee')) {
    errorMessage = `Please, increase gasMultiplier setting for ${currentNetwork} network. Fee of this network is higher, than provided`;
  }

  if (errorMessage.includes('An unknown RPC error occured')) {
    errorMessage = `An unknown RPC error occurred in ${currentNetwork} network`;
  }

  if (errorMessage.includes('execution reverted') && !isNftHoldingError) {
    // errorMessage = 'Unable to execute transaction for unknown reason';
  }

  if (errorMessage.includes('<!DOCTYPE html>')) {
    errorMessage = 'Something went wrong, its probably temporal server or cloudflare error';
  }
  for (const [originalMessage, customMessage] of Object.entries(CRITICAL_ERRORS_MAP)) {
    if (errorMessage.includes(originalMessage)) {
      return customMessage;
    }
  }

  for (const [originalMessage, customMessage] of Object.entries(WARNING_ERRORS_MAP)) {
    if (errorMessage.includes(originalMessage)) {
      return customMessage;
    }
  }

  for (const [originalMessage, customMessage] of Object.entries(PASSED_ERROR_MAP)) {
    if (errorMessage.includes(originalMessage)) {
      return customMessage;
    }
  }

  return errorMessage;
};
