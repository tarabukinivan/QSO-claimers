import axios from 'axios';

import { ResponseStatus } from '../../helpers';
import type { ChatDetails, SendMessageProps } from './types';

export const TG_BASE_URL = 'https://api.telegram.org/bot';

export const getTgChatIds = async (token: string) => {
  const url = `${TG_BASE_URL}${token}/getUpdates`;

  const response = await axios.get(url);
  const { ok: status = false, result = null } = response?.data || {};

  if (!status || !result || !result?.length) {
    throw new Error('TG API Error');
  }

  const uniqChatIds = new Set<number>();
  result.forEach((details: ChatDetails) => uniqChatIds.add(details.message.chat.id));

  return Array.from(uniqChatIds);
};

export const sendTgMessage = async ({ chatIds, token, message }: SendMessageProps) => {
  const url = `${TG_BASE_URL}${token}/sendMessage`;

  const requestPromises = chatIds.map(async (id) => {
    const params = { chat_id: id, text: message };
    return axios.post(url, params);
  });

  return Promise.all(requestPromises);
};

export const getTgMessageByStatus = (
  status: Exclude<ResponseStatus, 'passed'> = 'success',
  moduleName: string,
  message?: string
) => {
  const content = message ? `[${moduleName}]: ${message}` : moduleName;
  switch (status) {
    case 'success':
      return `✅ ${content}`;
    case 'warning':
      return `⚠️ ${content}`;
    case 'error':
      return `❌ ${content}`;
    case 'critical':
      return `💢 ${content}`;
  }
};
