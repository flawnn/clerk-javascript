import { isStaging } from './utils/instance';

export function parseSearchParams(queryString = ''): URLSearchParams {
  if (queryString.startsWith('?')) {
    queryString = queryString.slice(1);
  }
  return new URLSearchParams(queryString);
}

export function stripScheme(url = ''): string {
  return (url || '').replace(/^.+:\/\//, '');
}

export function addClerkPrefix(str: string | undefined) {
  if (!str) {
    return '';
  }
  let regex;
  if (str.match(/^(clerk\.)+\w*$/)) {
    regex = /(clerk\.)*(?=clerk\.)/;
  } else if (str.match(/\.clerk.accounts/)) {
    return str;
  } else {
    regex = /^(clerk\.)*/gi;
  }

  const stripped = str.replace(regex, '');
  return `clerk.${stripped}`;
}

/**
 *
 * Retrieve the clerk-js major tag using the major version from the version
 * param or use the frontendApi to determine if the staging tag should be used.
 * The default tag is `latest` and a `next` version also exists to retrieve
 * the next canary release.
 */
export const getClerkJsMajorVersionOrTag = (frontendApi: string, version?: string) => {
  if (!version && isStaging(frontendApi)) {
    return 'staging';
  }

  if (!version) {
    return 'latest';
  }

  if (version.includes('next')) {
    return 'next';
  }

  return version.split('.')[0] || 'latest';
};

/**
 *
 * Retrieve the clerk-js script url from the frontendApi and the major tag
 * using the {@link getClerkJsMajorVersionOrTag} or a provided clerkJSVersion tag.
 */
export const getScriptUrl = (frontendApi: string, { clerkJSVersion }: { clerkJSVersion?: string }) => {
  const noSchemeFrontendApi = frontendApi.replace(/http(s)?:\/\//, '');
  const major = getClerkJsMajorVersionOrTag(frontendApi, clerkJSVersion);
  return `https://${noSchemeFrontendApi}/npm/@clerk/clerk-js@${clerkJSVersion || major}/dist/clerk.browser.js`;
};
