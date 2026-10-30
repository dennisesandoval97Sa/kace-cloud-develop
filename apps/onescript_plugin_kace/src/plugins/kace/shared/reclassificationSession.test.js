import { afterEach, describe, expect, it } from 'vitest';
import {
  clearReclassificationSession,
  hasReclassificationSession,
  markReclassificationSession,
  reclassificationSessionTarget,
} from './reclassificationSession.js';

describe('reclassificationSession', () => {
  afterEach(() => {
    clearReclassificationSession();
  });

  it('marca la sesión del caso y devuelve su destino', () => {
    markReclassificationSession('caso-1', 'clas-destino');

    expect(hasReclassificationSession('caso-1')).toBe(true);
    expect(hasReclassificationSession('caso-2')).toBe(false);
    expect(reclassificationSessionTarget('caso-1')).toBe('clas-destino');
    expect(reclassificationSessionTarget('caso-2')).toBeNull();
  });

  it('compara el caso por valor, no por tipo', () => {
    markReclassificationSession(7, 'clas-destino');

    expect(hasReclassificationSession('7')).toBe(true);
    expect(reclassificationSessionTarget('7')).toBe('clas-destino');
  });

  it('se limpia a mano y con datos incompletos', () => {
    markReclassificationSession('caso-1', 'clas-destino');
    clearReclassificationSession();
    expect(hasReclassificationSession('caso-1')).toBe(false);

    markReclassificationSession('', 'clas-destino');
    expect(hasReclassificationSession('caso-1')).toBe(false);
    markReclassificationSession('caso-1', null);
    expect(hasReclassificationSession('caso-1')).toBe(false);
  });
});
