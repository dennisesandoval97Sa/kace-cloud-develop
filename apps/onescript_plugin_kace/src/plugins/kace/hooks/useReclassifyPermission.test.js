import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/** Emisor con la semántica de `Element.on`/`Element.off`: apila y da de baja por identidad. */
const createEmitter = () => {
  const registry = new Map();
  return {
    count: (name) => registry.get(name)?.length ?? 0,
    on: (name, handler) => {
      if (!registry.has(name)) registry.set(name, []);
      registry.get(name).push(handler);
    },
    off: (name, handler) => {
      const handlers = registry.get(name);
      if (!handlers) return;
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    },
  };
};

const mockStoreGet = vi.fn();

vi.mock('../KaceEngine', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'storeService') {
        return { get: mockStoreGet };
      }
      return null;
    },
  }),
}));

import {
  RECLASSIFY_PERMISSION_NAME,
  RECLASSIFY_PERMISSION_NAMESPACES,
  useReclassifyPermission,
} from './useReclassifyPermission.js';

const userDataWith = (administrador, agente) => ({
  permisions: { administrador, agente },
});

const GRANTED = [{ name: 'CaseReclassify', granted: true }];

/** Store con `user.user_data` y el `role_namespace` que envía el SPA en el handshake. */
const givenStore = ({ userData, roleNamespace }) => {
  mockStoreGet.mockImplementation((path) => {
    if (path === 'user.user_data') return userData;
    if (path === 'auth.handshake_params') {
      return roleNamespace ? { role_namespace: roleNamespace } : null;
    }
    return undefined;
  });
};

const onEvent = vi.fn();

describe('useReclassifyPermission', () => {
  it('en la vista de administrador concede el permiso otorgado en el namespace administrador', () => {
    givenStore({
      userData: userDataWith(GRANTED, []),
      roleNamespace: 'administrador',
    });

    const { result } = renderHook(() => useReclassifyPermission(onEvent));

    expect(result.current).toBe(true);
  });

  it('en la vista de administrador no concede el permiso otorgado solo en el namespace agente', () => {
    givenStore({
      userData: userDataWith([], GRANTED),
      roleNamespace: 'administrador',
    });

    const { result } = renderHook(() => useReclassifyPermission(onEvent));

    expect(result.current).toBe(false);
  });

  it('en la vista de agente concede el permiso otorgado en el namespace agente', () => {
    givenStore({
      userData: userDataWith([], GRANTED),
      roleNamespace: 'agente',
    });

    const { result } = renderHook(() => useReclassifyPermission(onEvent));

    expect(result.current).toBe(true);
  });

  it('en la vista de agente no concede el permiso otorgado solo en el namespace administrador', () => {
    givenStore({
      userData: userDataWith(GRANTED, []),
      roleNamespace: 'agente',
    });

    const { result } = renderHook(() => useReclassifyPermission(onEvent));

    expect(result.current).toBe(false);
  });

  it('sin role_namespace en el handshake no concede el permiso de ningún namespace', () => {
    givenStore({ userData: userDataWith(GRANTED, GRANTED) });

    const { result } = renderHook(() => useReclassifyPermission(onEvent));

    expect(result.current).toBe(false);
  });

  it('con un role_namespace desconocido no concede el permiso de ningún namespace', () => {
    givenStore({
      userData: userDataWith(GRANTED, GRANTED),
      roleNamespace: 'otro',
    });

    const { result } = renderHook(() => useReclassifyPermission(onEvent));

    expect(result.current).toBe(false);
  });

  it('no concede el permiso si no está otorgado', () => {
    givenStore({
      userData: userDataWith(
        [{ name: 'CaseReclassify', granted: false }],
        [{ name: 'CaseReclassify', granted: false }]
      ),
      roleNamespace: 'agente',
    });

    const { result } = renderHook(() => useReclassifyPermission(onEvent));

    expect(result.current).toBe(false);
  });

  it('no concede el permiso si no hay datos de usuario en el store', () => {
    givenStore({ userData: undefined, roleNamespace: 'agente' });

    const { result } = renderHook(() => useReclassifyPermission(onEvent));

    expect(result.current).toBe(false);
  });

  /**
   * Hallazgo de code review (MSKT-1392): `onEvent` es `this.on.bind(this)` y Formio lo re-crea en
   * cada redibujado (`renderReactComponent()`, que corre también en cada `setDisabled()`); sin
   * `offEvent` en la limpieza, cada redibujado apilaba otro listener `kaceAuthData` vivo sobre el
   * mismo emisor compartido — el mismo patrón que ya se corrigió en `DataTable`/`Multiselect`/
   * `Schema`.
   */
  it('se da de baja del evento kaceAuthData al desmontar, sin dejar nada colgando del emisor', () => {
    givenStore({ userData: userDataWith([], []) });
    const emitter = createEmitter();

    const { unmount } = renderHook(() =>
      useReclassifyPermission(
        (name, handler) => emitter.on(name, handler),
        (name, handler) => emitter.off(name, handler)
      )
    );

    expect(emitter.count('kaceAuthData')).toBe(1);
    unmount();
    expect(emitter.count('kaceAuthData')).toBe(0);
  });

  it('no revienta cuando el consumidor no aporta baja de listener', () => {
    givenStore({ userData: userDataWith([], []) });
    const emitter = createEmitter();

    const { unmount } = renderHook(() =>
      useReclassifyPermission((name, handler) => emitter.on(name, handler))
    );

    expect(() => unmount()).not.toThrow();
  });
});

/**
 * Lockstep (lección CR-003 — "tablas declarativas espejadas sin test estructural"): este bundle
 * no puede importar `@kace/core` en runtime (paquete separado, sin dependencia del monorepo —
 * ver `apps/onescript_plugin_kace/CLAUDE.md`), así que `RECLASSIFY_PERMISSION_NAMESPACES`/`_NAME`
 * son una copia obligada de `CASE_RECLASSIFY_PERMISSION` en
 * `@kace/core/src/shared/domain/rules/CanUseCapability.js` (backend SSOT). Un comentario no
 * detecta la divergencia si el backend cambia; este test lee el archivo fuente del backend en
 * runtime y compara contra los valores REALES que exporta el hook — no una lista copiada a mano
 * en el propio test, que reintroduciría el mismo bug.
 */
describe('useReclassifyPermission — namespaces en lockstep con el backend', () => {
  // `process.cwd()` y no `import.meta.url`: Vite sirve los módulos fuera de `src/` bajo un
  // pseudo-URL `http://localhost/@fs/...` en vez de `file://`, y `fileURLToPath` revienta con
  // ese esquema. `pnpm test` de este workspace (`vitest.config.js`) siempre corre con el cwd en
  // la raíz de `apps/onescript_plugin_kace` — ver `CLAUDE.md` de este paquete.
  const BACKEND_SOURCE_PATH = path.resolve(
    process.cwd(),
    '../../packages/kace_cloud_core/src/shared/domain/rules/CanUseCapability.js'
  );

  const readBackendCaseReclassifyPermission = () => {
    const source = readFileSync(BACKEND_SOURCE_PATH, 'utf8');
    const match = source.match(
      /CASE_RECLASSIFY_PERMISSION\s*=\s*Object\.freeze\(\{[\s\S]*?namespaces:\s*Object\.freeze\((\[[^\]]*\])\)[\s\S]*?name:\s*'([^']+)'/
    );
    if (!match) {
      throw new Error(
        `No se pudo leer CASE_RECLASSIFY_PERMISSION desde ${BACKEND_SOURCE_PATH}: el SSOT del backend cambió de forma y este test debe actualizarse.`
      );
    }
    return {
      namespaces: JSON.parse(match[1].replace(/'/g, '"')),
      name: match[2],
    };
  };

  it('RECLASSIFY_PERMISSION_NAMESPACES coincide con CASE_RECLASSIFY_PERMISSION.namespaces', () => {
    const backend = readBackendCaseReclassifyPermission();
    expect(RECLASSIFY_PERMISSION_NAMESPACES).toEqual(backend.namespaces);
  });

  it('RECLASSIFY_PERMISSION_NAME coincide con CASE_RECLASSIFY_PERMISSION.name', () => {
    const backend = readBackendCaseReclassifyPermission();
    expect(RECLASSIFY_PERMISSION_NAME).toBe(backend.name);
  });
});
