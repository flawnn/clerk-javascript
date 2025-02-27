import { runWithExponentialBackOff } from '@clerk/shared';
import { is4xxError } from '@clerk/shared/error';
import type {
  ActJWTClaim,
  GetToken,
  GetTokenOptions,
  IsAuthorized,
  SessionJSON,
  SessionResource,
  SessionStatus,
  TokenResource,
  UserResource,
} from '@clerk/types';

import { unixEpochToDate } from '../../utils/date';
import { eventBus, events } from '../events';
import { SessionTokenCache } from '../tokenCache';
import { PublicUserData } from './internal';
import { BaseResource, Token, User } from './internal';

export class Session extends BaseResource implements SessionResource {
  pathRoot = '/client/sessions';

  id!: string;
  status!: SessionStatus;
  lastActiveAt!: Date;
  lastActiveToken!: TokenResource | null;
  lastActiveOrganizationId!: string | null;
  actor!: ActJWTClaim | null;
  user!: UserResource | null;
  publicUserData!: PublicUserData;
  expireAt!: Date;
  abandonAt!: Date;
  createdAt!: Date;
  updatedAt!: Date;

  static isSessionResource(resource: unknown): resource is Session {
    return !!resource && resource instanceof Session;
  }

  constructor(data: SessionJSON) {
    super();

    this.fromJSON(data);
    this.#hydrateCache(this.lastActiveToken);
  }

  end = (): Promise<SessionResource> => {
    SessionTokenCache.clear();
    return this._basePost({
      action: 'end',
    });
  };

  remove = (): Promise<SessionResource> => {
    SessionTokenCache.clear();
    return this._basePost({
      action: 'remove',
    });
  };

  touch = (): Promise<SessionResource> => {
    return this._basePost({
      action: 'touch',
      body: { active_organization_id: this.lastActiveOrganizationId },
    });
  };

  clearCache = (): void => {
    return SessionTokenCache.clear();
  };

  // TODO: Fix this eslint error
  // eslint-disable-next-line @typescript-eslint/require-await
  getToken: GetToken = async (options?: GetTokenOptions): Promise<string | null> => {
    return runWithExponentialBackOff(() => this._getToken(options), {
      shouldRetry: (error: unknown, currentIteration: number) => !is4xxError(error) && currentIteration < 4,
    });
  };

  /**
   * @experimental The method is experimental and subject to change in future releases.
   */
  isAuthorized: IsAuthorized = async params => {
    return new Promise(resolve => {
      // if there is no active organization user can not be authorized
      if (!this.lastActiveOrganizationId || !this.user) {
        return resolve(false);
      }

      // loop through organizationMemberships from client piggybacking
      const orgMemberships = this.user.organizationMemberships || [];
      const activeMembership = orgMemberships.find(mem => mem.organization.id === this.lastActiveOrganizationId);

      // Based on FAPI this should never happen, but we handle it anyway
      if (!activeMembership) {
        return resolve(false);
      }

      const activeOrganizationPermissions = activeMembership.permissions;
      const activeOrganizationRole = activeMembership.role;

      if (params.permission) {
        return resolve(activeOrganizationPermissions.includes(params.permission));
      }
      if (params.role) {
        return resolve(activeOrganizationRole === params.role);
      }
      return resolve(false);
    });
  };

  #hydrateCache = (token: TokenResource | null) => {
    if (token) {
      SessionTokenCache.set({
        tokenId: this.#getCacheId(),
        tokenResolver: Promise.resolve(token),
      });
      eventBus.dispatch(events.TokenUpdate, { token });
    }
  };

  // If it's a session token, retrieve it with their session id, otherwise it's a jwt template token
  // and retrieve it using the session id concatenated with the jwt template name.
  // e.g. session id is 'sess_abc12345' and jwt template name is 'haris'
  // The session token ID will be 'sess_abc12345' and the jwt template token ID will be 'sess_abc12345-haris'
  #getCacheId(template?: string) {
    return `${template ? `${this.id}-${template}` : this.id}-${this.updatedAt.getTime()}`;
  }

  #isLegacyIntegrationRequest = (template: string | undefined): boolean => {
    return !!template && template.startsWith('integration_');
  };

  #removeLegacyIntegrationPrefix = (template: string | undefined): string => {
    return (template || '').replace('integration_', '');
  };

  // Can be removed once `integration_firebase` are no longer supported
  #handleLegacyIntegrationToken = async (options: GetTokenOptions): Promise<string> => {
    const { template, leewayInSeconds } = options;
    const cachedEntry = SessionTokenCache.get({ tokenId: this.user!.id, audience: template }, leewayInSeconds);
    if (cachedEntry) {
      return cachedEntry.tokenResolver.then(res => res.getRawString());
    }
    const tokenResolver = Token.create(this.user!.pathRoot + '/tokens', {
      service: this.#removeLegacyIntegrationPrefix(template),
    });
    SessionTokenCache.set({
      tokenId: this.user!.id,
      audience: template,
      tokenResolver,
    });
    return tokenResolver.then(token => {
      eventBus.dispatch(events.TokenUpdate, { token });
      return token.getRawString();
    });
  };

  protected fromJSON(data: SessionJSON | null): this {
    if (!data) {
      return this;
    }

    this.id = data.id;
    this.status = data.status;
    this.expireAt = unixEpochToDate(data.expire_at);
    this.abandonAt = unixEpochToDate(data.abandon_at);
    this.lastActiveAt = unixEpochToDate(data.last_active_at);
    this.lastActiveOrganizationId = data.last_active_organization_id;
    this.actor = data.actor;
    this.createdAt = unixEpochToDate(data.created_at);
    this.updatedAt = unixEpochToDate(data.updated_at);
    this.user = new User(data.user);

    if (data.public_user_data) {
      this.publicUserData = new PublicUserData(data.public_user_data);
    }

    this.lastActiveToken = data.last_active_token ? new Token(data.last_active_token) : null;

    return this;
  }

  private async _getToken(options?: GetTokenOptions): Promise<string | null> {
    if (!this.user) {
      return null;
    }

    const { leewayInSeconds, template, skipCache = false } = options || {};
    if (!template && Number(leewayInSeconds) >= 60) {
      throw new Error('Leeway can not exceed the token lifespan (60 seconds)');
    }

    if (this.#isLegacyIntegrationRequest(template)) {
      return this.#handleLegacyIntegrationToken({ template, leewayInSeconds, skipCache });
    }

    const tokenId = this.#getCacheId(template);
    const cachedEntry = skipCache ? undefined : SessionTokenCache.get({ tokenId }, leewayInSeconds);

    if (cachedEntry) {
      return cachedEntry.tokenResolver.then(res => res.getRawString());
    }
    const path = template ? `${this.path()}/tokens/${template}` : `${this.path()}/tokens`;
    const tokenResolver = Token.create(path);
    SessionTokenCache.set({ tokenId, tokenResolver });
    return tokenResolver.then(token => {
      // Dispatch tokenUpdate only for __session tokens and not JWT templates
      if (!template) {
        eventBus.dispatch(events.TokenUpdate, { token });
      }
      return token.getRawString();
    });
  }
}
