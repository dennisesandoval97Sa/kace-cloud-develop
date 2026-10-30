import { describe, expect, it } from 'vitest';
import { mergeScriptSelectOptions } from './mergeScriptSelectOptions.js';

describe('mergeScriptSelectOptions', () => {
  it('replace returns incoming array copy', () => {
    const incoming = [{ label: 'b', value: '2' }];
    const out = mergeScriptSelectOptions(
      [{ label: 'a', value: '1' }],
      incoming,
      false
    );
    expect(out).toEqual(incoming);
    expect(out).not.toBe(incoming);
  });

  it('append concatenates and dedupes by value keeping last occurrence', () => {
    const out = mergeScriptSelectOptions(
      [{ label: 'a', value: '1' }],
      [
        { label: 'b', value: '2' },
        { label: 'A2', value: '1' },
      ],
      true
    );
    expect(out).toEqual([
      { label: 'b', value: '2' },
      { label: 'A2', value: '1' },
    ]);
  });

  it('non-array incoming yields empty replace', () => {
    expect(
      mergeScriptSelectOptions([{ label: 'a', value: '1' }], null, false)
    ).toEqual([]);
  });
});
