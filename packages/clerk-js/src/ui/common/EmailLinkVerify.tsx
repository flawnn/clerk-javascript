import { EmailLinkErrorCode, isEmailLinkError } from '@clerk/shared/error';
import React from 'react';

import type { VerificationStatus } from '../../utils/getClerkQueryParam';
import { useCoreClerk, useCoreSignUp } from '../contexts';
import type { LocalizationKey } from '../localization';
import { useRouter } from '../router';
import { sleep } from '../utils';
import { completeSignUpFlow } from '../utils/completeSignUpFlow';
import { EmailLinkStatusCard } from './EmailLinkStatusCard';

export type EmailLinkVerifyProps = {
  redirectUrlComplete?: string;
  redirectUrl?: string;
  verifyEmailPath?: string;
  verifyPhonePath?: string;
  texts: Record<VerificationStatus, { title: LocalizationKey; subtitle: LocalizationKey }>;
};

export const EmailLinkVerify = (props: EmailLinkVerifyProps) => {
  const { redirectUrl, redirectUrlComplete, verifyEmailPath, verifyPhonePath } = props;
  const { handleEmailLinkVerification } = useCoreClerk();
  const { navigate } = useRouter();
  const signUp = useCoreSignUp();
  const [verificationStatus, setVerificationStatus] = React.useState<VerificationStatus>('loading');

  const startVerification = async () => {
    try {
      // Avoid loading flickering
      await sleep(750);
      await handleEmailLinkVerification({ redirectUrlComplete, redirectUrl }, navigate);
      setVerificationStatus('verified_switch_tab');
      await sleep(750);
      return completeSignUpFlow({
        signUp,
        verifyEmailPath,
        verifyPhonePath,
        navigate,
      });
    } catch (err) {
      let status: VerificationStatus = 'failed';
      if (isEmailLinkError(err) && err.code === EmailLinkErrorCode.Expired) {
        status = 'expired';
      }
      setVerificationStatus(status);
    }
  };

  React.useEffect(() => {
    void startVerification();
  }, []);

  return (
    <EmailLinkStatusCard
      title={props.texts[verificationStatus]?.title || ''}
      subtitle={props.texts[verificationStatus]?.subtitle || ''}
      status={verificationStatus}
    />
  );
};
