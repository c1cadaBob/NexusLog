// ============================================================================
// 字段映射类型
// ============================================================================

export type FieldType = 'String' | 'Integer' | 'Long' | 'Float' | 'Boolean' | 'Date' | 'IP Addr';
export type MappingStatus = 'Active' | 'Pending' | 'Error';

export interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  fieldType: FieldType;
  status: MappingStatus;
  isEditing?: boolean;
}

export const FIELD_TYPES: { value: FieldType; color: string }[] = [
  { value: 'String', color: 'blue' },
  { value: 'Integer', color: 'purple' },
  { value: 'Long', color: 'orange' },
  { value: 'Float', color: 'green' },
  { value: 'Boolean', color: 'magenta' },
  { value: 'Date', color: 'pink' },
  { value: 'IP Addr', color: 'geekblue' },
];

// ============================================================================
// 解析规则类型
// ============================================================================

export type ParserType = 'GROK' | 'REGEX' | 'JSON' | 'KEY-VALUE' | 'CSV';
export type RuleTestStatus = 'Passed' | 'Failed' | 'Untested';

export interface ParsingRule {
  id: string;
  name: string;
  source: string;
  parserType: ParserType;
  pattern: string;
  status: RuleTestStatus;
  lastUpdated: string;
}

// ============================================================================
// 脱敏规则类型
// ============================================================================

export type MaskType = 'partial' | 'replace' | 'hash' | 'truncate' | 'null';

export interface MaskingRule {
  id: string;
  name: string;
  description: string;
  field: string;
  maskType: MaskType;
  pattern?: string;
  scope: string;
  enabled: boolean;
  priority: number;
}

export const MASK_TYPES: { value: MaskType; label: string; icon: string; color: string }[] = [
  { value: 'partial', label: '部分隐藏', icon: 'visibility_off', color: 'purple' },
  { value: 'replace', label: '替换', icon: 'find_replace', color: 'warning' },
  { value: 'hash', label: 'MD5 加密', icon: 'lock', color: 'geekblue' },
  { value: 'truncate', label: '截断', icon: 'content_cut', color: 'error' },
  { value: 'null', label: '置空', icon: 'block', color: 'default' },
];

// ============================================================================
// 字段字典类型
// ============================================================================

export type DictionaryFieldType = 'String' | 'Integer' | 'Float' | 'Boolean' | 'Timestamp' | 'IP';

export interface FieldDefinition {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  type: DictionaryFieldType;
  references: number;
  verified: boolean;
}

export const DICTIONARY_FIELD_TYPES: { value: DictionaryFieldType; color: string }[] = [
  { value: 'String', color: 'gold' },
  { value: 'Integer', color: 'purple' },
  { value: 'Float', color: 'orange' },
  { value: 'Boolean', color: 'green' },
  { value: 'Timestamp', color: 'magenta' },
  { value: 'IP', color: 'blue' },
];
