export type RealtimeQueryFilterPrimitive = string | number | boolean;

export type RealtimeQueryFilterValue =
  | RealtimeQueryFilterPrimitive
  | RealtimeQueryFilterValue[]
  | RealtimeQueryFilters;

export interface RealtimeQueryFilters {
  [key: string]: RealtimeQueryFilterValue;
}
