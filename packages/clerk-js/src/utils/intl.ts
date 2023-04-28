function supportedLocalesOf(locale?: string | string[]) {
  if (!locale) {
    return true;
  }
  const locales = Array.isArray(locale) ? locale : [locale];
  return (Intl as any).ListFormat.supportedLocalesOf(locales).length === locales.length;
}

/**
 * Intl.ListFormat was introduced in 2021
 * It is recommended to first check for browser support before using it
 */
export function canUseListFormat(locale = 'en') {
  return 'ListFormat' in Intl && supportedLocalesOf(locale);
}
