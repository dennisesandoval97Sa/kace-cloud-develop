import { describe, expect, it } from 'vitest';
import {
  isSelectValueInCatalog,
  pruneMultiselectToCatalog,
} from './selectCatalogReconcile.js';

describe('selectCatalogReconcile', () => {
  describe('isSelectValueInCatalog', () => {
    it('returns true for empty value so caller skips clear', () => {
      expect(isSelectValueInCatalog('', [{ value: 'a', label: 'A' }])).toBe(
        true
      );
    });

    it('returns true when value exists with string coercion', () => {
      expect(isSelectValueInCatalog(1, [{ value: '1', label: 'One' }])).toBe(
        true
      );
    });

    it('returns false when value missing from catalog', () => {
      expect(isSelectValueInCatalog('x', [{ value: 'a', label: 'A' }])).toBe(
        false
      );
    });

    it('returns true when allOptions is not an array', () => {
      expect(isSelectValueInCatalog('x', null)).toBe(true);
    });
  });

  describe('pruneMultiselectToCatalog', () => {
    it('keeps only entries present in options', () => {
      const selected = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      const options = [{ value: 'b', label: 'B' }];
      expect(pruneMultiselectToCatalog(selected, options)).toEqual([
        { value: 'b', label: 'B' },
      ]);
    });

    it('returns same array when all match', () => {
      const selected = [{ value: 'a', label: 'A' }];
      const options = [{ value: 'a', label: 'A' }];
      expect(pruneMultiselectToCatalog(selected, options)).toEqual(selected);
    });

    it('returns selected unchanged when options not array', () => {
      const selected = [{ value: 'a', label: 'A' }];
      expect(pruneMultiselectToCatalog(selected, null)).toEqual(selected);
    });
  });
});
