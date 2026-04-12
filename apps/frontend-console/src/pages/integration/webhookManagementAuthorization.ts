import { hasAnyCapability } from '../../auth/routeAuthorization';
import type { AuthorizationSnapshot } from '../../types/authz';

export interface WebhookManagementActionAccess {
  canReadWebhook: boolean;
  canCreateWebhook: boolean;
  canUpdateWebhook: boolean;
  canDeleteWebhook: boolean;
  canTestWebhook: boolean;
}

export function resolveWebhookManagementActionAccess(
  authorization: Pick<AuthorizationSnapshot, 'capabilities'>,
): WebhookManagementActionAccess {
  return {
    canReadWebhook: hasAnyCapability(authorization.capabilities, ['notification.channel.read_metadata', 'integration.webhook.read_metadata']),
    canCreateWebhook: hasAnyCapability(authorization.capabilities, ['notification.channel.create', 'integration.webhook.create']),
    canUpdateWebhook: hasAnyCapability(authorization.capabilities, ['notification.channel.update', 'integration.webhook.update']),
    canDeleteWebhook: hasAnyCapability(authorization.capabilities, ['notification.channel.delete', 'integration.webhook.delete']),
    canTestWebhook: hasAnyCapability(authorization.capabilities, ['notification.channel.test', 'integration.webhook.test']),
  };
}
