import { DEV_SUFFIXES, STAGING_SUFFIXES } from '../constants';
import { parsePublishableKey } from '../keys';

export const apiUrlFromPublishableKey = (publishableKey: string) => {
  const frontendApi = parsePublishableKey(publishableKey)?.frontendApi;
  if (DEV_SUFFIXES.some(suffix => frontendApi?.endsWith(suffix))) {
    return 'https://api.lclclerk.com';
  }
  if (STAGING_SUFFIXES.some(suffix => frontendApi?.endsWith(suffix))) {
    return 'https://api.clerkstage.dev';
  }
  return 'https://api.clerk.com';
};
