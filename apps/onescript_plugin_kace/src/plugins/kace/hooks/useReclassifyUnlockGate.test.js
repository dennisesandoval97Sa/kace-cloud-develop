import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReclassifyUnlockGate } from './useReclassifyUnlockGate.js';

const mockUseGlobalConfig = vi.fn();
vi.mock('#plugins/kace/hooks/useGlobalConfig.js', () => ({
  GLOBAL_CONFIG_PATHS: {
    ALLOW_CASE_RECLASSIFICATION: 'config.allow_case_reclassification',
  },
  useGlobalConfig: (...args) => mockUseGlobalConfig(...args),
}));

const mockUseReclassifyPermission = vi.fn();
vi.mock('#plugins/kace/hooks/useReclassifyPermission.js', () => ({
  useReclassifyPermission: (...args) => mockUseReclassifyPermission(...args),
}));

describe('useReclassifyUnlockGate', () => {
  const baseProps = {
    onEvent: vi.fn(),
    caseHasClassification: true,
    caseIsClosed: false,
  };

  it('se desbloquea cuando el flag del tenant, el permiso de rol y las condiciones del caso lo permiten', () => {
    mockUseGlobalConfig.mockReturnValue(true);
    mockUseReclassifyPermission.mockReturnValue(true);

    const { result } = renderHook(() => useReclassifyUnlockGate(baseProps));

    expect(result.current.reclassifyUnlocked).toBe(true);
    expect(result.current.reclassifyUnlockedRef.current).toBe(true);
  });

  it('permanece bloqueado mientras el flag del tenant no resolvió (undefined)', () => {
    mockUseGlobalConfig.mockReturnValue(undefined);
    mockUseReclassifyPermission.mockReturnValue(true);

    const { result } = renderHook(() => useReclassifyUnlockGate(baseProps));

    expect(result.current.reclassifyUnlocked).toBe(false);
  });

  /**
   * BUG-4 (reporte de agente 2026-09-21): el commit 0f985f95e dejó el gate dependiendo SOLO del
   * flag global. El agente sin el permiso de rol `CaseReclassify` no debe ver el desplegable
   * desbloqueado, aunque el tenant tenga el flag activo.
   */
  it('permanece bloqueado sin el permiso de rol CaseReclassify, aunque el flag del tenant esté activo', () => {
    mockUseGlobalConfig.mockReturnValue(true);
    mockUseReclassifyPermission.mockReturnValue(false);

    const { result } = renderHook(() => useReclassifyUnlockGate(baseProps));

    expect(result.current.reclassifyUnlocked).toBe(false);
  });

  it('permanece bloqueado con un caso cerrado aunque el resto de condiciones se cumplan', () => {
    mockUseGlobalConfig.mockReturnValue(true);
    mockUseReclassifyPermission.mockReturnValue(true);

    const { result } = renderHook(() =>
      useReclassifyUnlockGate({ ...baseProps, caseIsClosed: true })
    );

    expect(result.current.reclassifyUnlocked).toBe(false);
  });

  it('el ref se mantiene sincronizado con el valor tras un re-render', () => {
    mockUseGlobalConfig.mockReturnValue(true);
    mockUseReclassifyPermission.mockReturnValue(true);

    const { result, rerender } = renderHook(
      (props) => useReclassifyUnlockGate(props),
      { initialProps: baseProps }
    );
    expect(result.current.reclassifyUnlocked).toBe(true);

    mockUseGlobalConfig.mockReturnValue(false);
    rerender({ ...baseProps, caseIsClosed: false });

    expect(result.current.reclassifyUnlocked).toBe(false);
    expect(result.current.reclassifyUnlockedRef.current).toBe(false);
  });

  it('reenvía offEvent a useGlobalConfig para dar de baja kaceAuthData', () => {
    const offEvent = vi.fn();
    mockUseGlobalConfig.mockReturnValue(true);
    mockUseReclassifyPermission.mockReturnValue(true);

    renderHook(() => useReclassifyUnlockGate({ ...baseProps, offEvent }));

    expect(mockUseGlobalConfig).toHaveBeenCalledWith(
      baseProps.onEvent,
      'config.allow_case_reclassification',
      offEvent
    );
  });
});
