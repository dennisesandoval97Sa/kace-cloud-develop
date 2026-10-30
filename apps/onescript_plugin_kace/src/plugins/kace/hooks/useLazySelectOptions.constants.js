/**
 * Form.io / Kace events that should mark dynamic-select option caches as stale
 * (unless the component is configured with refetch on every open / on events).
 */
export const LAZY_SELECT_EVENTS = Object.freeze([
  'kaceAuthData',
  'resetForm',
  'redraw',
]);
