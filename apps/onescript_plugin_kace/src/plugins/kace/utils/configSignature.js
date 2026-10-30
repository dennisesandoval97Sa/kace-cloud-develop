import { stableStringify } from './kaceHttpCache.js';

export function configSignature(settings) {
  return stableStringify(settings);
}
