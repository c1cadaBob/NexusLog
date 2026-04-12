import { hasAnyCapability } from '../../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../../types/authz';

export interface LoginPolicyActionAccess {
  canReadLoginPolicy: boolean;
  canUpdateLoginPolicy: boolean;
}

export function resolveLoginPolicyActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'capabilities'>,
): LoginPolicyActionAccess {
  return {
    canReadLoginPolicy: hasAnyCapability(authorization.capabilities, ['auth.login_policy.read']),
    canUpdateLoginPolicy: hasAnyCapability(authorization.capabilities, ['auth.login_policy.update']),
  };
}
