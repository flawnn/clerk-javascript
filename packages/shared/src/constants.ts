export const DEV_SUFFIXES = [
  '.lcl.dev',
  '.lclstage.dev',
  '.dev.lclclerk.com',
  '.accounts.lclclerk.com',
  '.stg.lclclerk.com',
];

export const STAGING_SUFFIXES = ['.stg.dev', '.stgstage.dev', 'accountsstage.dev'];

export const DEV_OR_STAGING_SUFFIXES = [...DEV_SUFFIXES, ...STAGING_SUFFIXES];
