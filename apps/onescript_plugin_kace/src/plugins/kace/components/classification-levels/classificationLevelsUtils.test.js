import { describe, expect, it } from 'vitest';
import {
  buildLevelLabelsFromTree,
  buildLevelLabelsForOutput,
  readLevelValuesFromData,
  resolveSelectionFromData,
  shouldShowClassificationLevel,
  validateSelectionAgainstTree,
} from './classificationLevelsUtils.js';

describe('classificationLevelsUtils', () => {
  const tree = [
    {
      value: 'A',
      label: 'A',
      options: [
        {
          value: 'B',
          label: 'B',
          options: [{ value: 'C', label: 'C' }],
        },
      ],
    },
  ];

  it('builds labels from tree for form output', () => {
    expect(
      buildLevelLabelsFromTree(tree, { nivel1: 'A', nivel2: 'B' })
    ).toEqual({ nivel1: 'A', nivel2: 'B' });
  });

  it('falls back to stored selection when tree is empty', () => {
    expect(
      buildLevelLabelsForOutput([], { nivel1: 'BACK SAC', nivel2: 'Copia' })
    ).toEqual({ nivel1: 'BACK SAC', nivel2: 'Copia' });
  });

  it('resolves stored labels back to internal values', () => {
    expect(
      resolveSelectionFromData(tree, { nivel1: 'A', nivel2: 'B' })
    ).toEqual({ nivel1: 'A', nivel2: 'B' });
  });

  it('validates selection against tree by label or value', () => {
    expect(
      validateSelectionAgainstTree(tree, { nivel1: 'A', nivel2: 'B' })
    ).toEqual({ nivel1: 'A', nivel2: 'B' });
  });

  it('reads level values from form data', () => {
    expect(
      readLevelValuesFromData({ nivel1: 'x', other: 1, nivel3: 'z' })
    ).toEqual({ nivel1: 'x', nivel3: 'z' });
  });

  it('reads level values nested under component key', () => {
    expect(
      readLevelValuesFromData(
        {
          reclasificacionNiveles: {
            nivel1: 'BACK SAC',
            nivel2: 'Copia de Poliza',
          },
        },
        'reclasificacionNiveles'
      )
    ).toEqual({ nivel1: 'BACK SAC', nivel2: 'Copia de Poliza' });
  });

  it('shows nested levels only when parent has children', () => {
    expect(shouldShowClassificationLevel('nivel1', tree, {})).toBe(true);
    expect(shouldShowClassificationLevel('nivel2', tree, {})).toBe(false);
    expect(shouldShowClassificationLevel('nivel2', tree, { nivel1: 'A' })).toBe(
      true
    );
    expect(
      shouldShowClassificationLevel('nivel3', tree, {
        nivel1: 'A',
        nivel2: 'B',
      })
    ).toBe(true);
    expect(
      shouldShowClassificationLevel('nivel3', tree, {
        nivel1: 'A',
        nivel2: 'X',
      })
    ).toBe(false);
  });
});
