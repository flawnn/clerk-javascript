---
'@clerk/backend': major
---

Drop deprecated properties. Migration steps:
- remove `InterstitialAPI` and `remotePrivateInterstitial`
- use `createClerkClient` instead of `__unstable_options`
- replace `publishableKey` with `frontendApi`
- replace `clockSkewInMs` with `clockSkewInSeconds`
- replace `apiKey` with `secretKey`
- replace `SetClerkSecretKeyOrAPIKey` enum with `SetClerkSecretKey`
- remove `httpOptions`
- replace `image` with  // TODO
- remove `pkgVersion`
- replace `Organization.getOrganizationInvitationList` with // TODO
- removed `orgs` claim (add it manually by adding `user.organizations` in a jwt template)