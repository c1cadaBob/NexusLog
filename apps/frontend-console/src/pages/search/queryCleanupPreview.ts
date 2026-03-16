export type QueryCleanupPreviewFilter = {
  key: string;
  label: string;
  value: string;
};

export function formatQueryCleanupFilterLabel(key: string): string {
  switch (key) {
    case 'level':
      return '级别';
    case 'service':
      return '来源/服务';
    case 'source':
      return '来源';
    default:
      return key;
  }
}

export function formatQueryCleanupFilterValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ');
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value ?? '');
}

export function buildQueryCleanupPreviewFilters(filters: Record<string, unknown>): QueryCleanupPreviewFilter[] {
  return Object.entries(filters)
    .filter(([, value]) => value != null && value !== '' && (!Array.isArray(value) || value.length > 0))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      label: formatQueryCleanupFilterLabel(key),
      value: formatQueryCleanupFilterValue(value),
    }));
}
