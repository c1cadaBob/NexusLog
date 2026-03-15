export interface ActorFlags {
  reserved: boolean;
  interactive_login_allowed: boolean;
  system_subject: boolean;
  [key: string]: boolean;
}

export interface AuthorizationSnapshot {
  permissions: string[];
  capabilities: string[];
  scopes: string[];
  entitlements: string[];
  featureFlags: string[];
  authzEpoch: number;
  actorFlags: ActorFlags;
}

export interface AuthorizationState extends AuthorizationSnapshot {
  authzReady: boolean;
}

export const DEFAULT_ACTOR_FLAGS: ActorFlags = {
  reserved: false,
  interactive_login_allowed: false,
  system_subject: false,
};

export const EMPTY_AUTHORIZATION_SNAPSHOT: AuthorizationSnapshot = {
  permissions: [],
  capabilities: [],
  scopes: [],
  entitlements: [],
  featureFlags: [],
  authzEpoch: 0,
  actorFlags: DEFAULT_ACTOR_FLAGS,
};

export const EMPTY_AUTHORIZATION_STATE: AuthorizationState = {
  ...EMPTY_AUTHORIZATION_SNAPSHOT,
  authzReady: false,
};

export function normalizeActorFlags(actorFlags?: Record<string, boolean> | null): ActorFlags {
  return {
    ...DEFAULT_ACTOR_FLAGS,
    ...(actorFlags ?? {}),
  };
}
