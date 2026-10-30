import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaseTabRefreshFloating } from './CaseTabRefreshFloating.jsx';

vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: { get: () => null, set: vi.fn() },
}));

// `useGlobalConfig` tiene su propia fuga preexistente de `kaceAuthData` (no forma parte de este
// hallazgo): se mockea para aislar la suscripción propia de `CaseTabRefreshFloating`.
vi.mock('#plugins/kace/hooks/useGlobalConfig.js', async () => {
  const actual = await vi.importActual(
    '#plugins/kace/hooks/useGlobalConfig.js'
  );
  return { ...actual, useGlobalConfig: () => false };
});

/**
 * Fuga de listeners (code review MSKT-1392): `auth/index.js` pasa `onEvent: this.on.bind(this)`,
 * una función nueva en cada `renderReactComponent()` y en `setDisabled()`. Sin `offEvent` en la
 * limpieza, cada redibujado apilaba otro listener `kaceAuthData` vivo sobre el emisor compartido
 * de Form.io. El emisor real (`Element.on`/`off`) apila y da de baja por identidad — un doble que
 * solo indexa por nombre no vería el problema.
 */
describe('CaseTabRefreshFloating — suscripción a los eventos del componente', () => {
  function createEmitter() {
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
  }

  const propsWith = (emitter) => ({
    onEvent: (name, handler) => emitter.on(name, handler),
    offEvent: (name, handler) => emitter.off(name, handler),
  });

  it('deja una sola suscripción de kaceAuthData aunque el componente se redibuje (setDisabled)', () => {
    const emitter = createEmitter();
    const { rerender } = render(
      <CaseTabRefreshFloating {...propsWith(emitter)} />
    );
    rerender(<CaseTabRefreshFloating {...propsWith(emitter)} />);
    rerender(<CaseTabRefreshFloating {...propsWith(emitter)} />);

    expect(emitter.count('kaceAuthData')).toBe(1);
  });

  it('se da de baja al desmontar, sin dejar nada colgando del emisor compartido', () => {
    const emitter = createEmitter();
    const { unmount } = render(
      <CaseTabRefreshFloating {...propsWith(emitter)} />
    );

    unmount();

    expect(emitter.count('kaceAuthData')).toBe(0);
  });
});
