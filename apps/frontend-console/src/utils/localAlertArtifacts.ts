const LOCAL_ALERT_ARTIFACT_MARKERS = [
  'local-host-token-alert',
  'local-fullchain-',
  'local-e2e-',
  'nexuslog_local_',
  'nexuslog_alert_e2e_',
  'bootstrap token',
  'local e2e keyword alert',
  'local post-patch e2e alert',
];

export const isLocalAlertArtifact = (...fields: Array<string | null | undefined>): boolean => {
  const fingerprint = fields
    .filter((field): field is string => Boolean(field && field.trim()))
    .join('\n')
    .toLowerCase();

  if (!fingerprint) {
    return false;
  }

  return LOCAL_ALERT_ARTIFACT_MARKERS.some((marker) => fingerprint.includes(marker));
};
