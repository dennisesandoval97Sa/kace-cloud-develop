import { describe, it, expect } from 'vitest';
import { flatCaseToSubmissionCase } from './buildInitialCaseData.js';

describe('flatCaseToSubmissionCase', () => {
  const baseCtx = {
    currentCaseId: 'case-001',
    grupoId: 'group-001',
    payload: { client_id: 'client-001', user_id: 'user-001' },
    descripcionCasoId: 'desc-001',
  };

  it('copies transicion_id to current_transicion_id at load time', () => {
    const flat = { transicion_id: 'trans-123', id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result.current_transicion_id).toBe('trans-123');
    expect(result.transicion_id).toBe('trans-123');
  });

  it('omits current_transicion_id when transicion_id is not on the loaded case', () => {
    const flat = { id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result).not.toHaveProperty('current_transicion_id');
    expect(result.transicion_id).toBeNull();
  });

  it('current_transicion_id reflects original value independently of transicion_id mutation', () => {
    const flat = { transicion_id: 'trans-123' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    result.transicion_id = 'trans-999';
    expect(result.current_transicion_id).toBe('trans-123');
  });

  it('copies responsable_id to current_responsable_id at load time', () => {
    const flat = { responsable_id: 'user-123', id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result.current_responsable_id).toBe('user-123');
    expect(result.responsable_id).toBe('user-123');
  });

  it('omits current_responsable_id when responsable_id is not on the loaded case', () => {
    const flat = { id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, {
      ...baseCtx,
      payload: { client_id: 'client-001' },
    });
    expect(result).not.toHaveProperty('current_responsable_id');
  });

  it('sends current_responsable_id null when the loaded case had no responsable', () => {
    const flat = { id: 'case-001', responsable_id: null };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result.current_responsable_id).toBeNull();
  });

  it('current_responsable_id reflects original value independently of responsable_id mutation', () => {
    const flat = { responsable_id: 'user-123' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    result.responsable_id = 'user-999';
    expect(result.current_responsable_id).toBe('user-123');
  });

  it('copies cliente_id to current_cliente_id at load time', () => {
    const flat = { cliente_id: 'client-123', id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result.current_cliente_id).toBe('client-123');
    expect(result.cliente_id).toBe('client-123');
  });

  it('omits current_cliente_id when cliente_id is not on the loaded case', () => {
    const flat = { id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, {
      ...baseCtx,
      payload: { user_id: 'user-001' },
    });
    expect(result).not.toHaveProperty('current_cliente_id');
  });

  it('sends current_cliente_id null when the loaded case had no cliente', () => {
    const flat = { id: 'case-001', cliente_id: null };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result.current_cliente_id).toBeNull();
  });

  it('current_cliente_id reflects original value independently of cliente_id mutation', () => {
    const flat = { cliente_id: 'client-123' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    result.cliente_id = 'client-999';
    expect(result.current_cliente_id).toBe('client-123');
  });

  it('copies clasificacion_id to current_clasificacion_id at load time', () => {
    const flat = { clasificacion_id: 'class-123', id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result.current_clasificacion_id).toBe('class-123');
    expect(result.clasificacion_id).toBe('class-123');
  });

  it('omits current_clasificacion_id when clasificacion_id is not on the loaded case', () => {
    const flat = { id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result).not.toHaveProperty('current_clasificacion_id');
  });

  it('current_clasificacion_id reflects original value independently of clasificacion_id mutation', () => {
    const flat = { clasificacion_id: 'class-123' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    result.clasificacion_id = 'class-999';
    expect(result.current_clasificacion_id).toBe('class-123');
  });

  it('copies grupo_id to current_grupo_id at load time', () => {
    const flat = { grupo_id: 'group-123', id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result.current_grupo_id).toBe('group-123');
    expect(result.grupo_id).toBe('group-123');
  });

  it('omits current_grupo_id when grupo_id is not on the loaded case', () => {
    const flat = { id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result).not.toHaveProperty('current_grupo_id');
  });

  it('current_grupo_id reflects original value independently of grupo_id mutation', () => {
    const flat = { grupo_id: 'group-123' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    result.grupo_id = 'group-999';
    expect(result.current_grupo_id).toBe('group-123');
  });
});
