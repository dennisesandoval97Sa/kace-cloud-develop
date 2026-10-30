import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassificationLevels } from './ClassificationLevels.jsx';

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: () => ({
      fetchGroupClassification: vi.fn().mockResolvedValue([]),
    }),
  }),
}));

vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: { get: () => null, set: vi.fn() },
}));

/**
 * Fuga de listeners (code review MSKT-1392): `index.js` liga `onEvent`/`offEvent` UNA sola vez
 * en el constructor (`this.boundOnEvent`/`this.boundOffEvent`), pero `useClassificationLevelsSelect`
 * registraba `resetForm` con un handler anónimo inline — imposible de dar de baja por identidad
 * aunque `offEvent` estuviera disponible. El emisor real (`Element.on`/`off`) apila y da de baja
 * por identidad — un doble que solo indexa por nombre no vería el problema.
 */
describe('ClassificationLevels — suscripción a los eventos del componente', () => {
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
    component: { key: 'clEvt' },
    data: {},
    onEvent: (name, handler) => emitter.on(name, handler),
    offEvent: (name, handler) => emitter.off(name, handler),
  });

  it('deja una sola suscripción por evento aunque el componente se redibuje (setDisabled)', () => {
    const emitter = createEmitter();
    const { rerender } = render(
      <ClassificationLevels {...propsWith(emitter)} />
    );
    rerender(<ClassificationLevels {...propsWith(emitter)} />);
    rerender(<ClassificationLevels {...propsWith(emitter)} />);

    expect(emitter.count('kaceAuthData')).toBe(1);
    expect(emitter.count('redraw')).toBe(1);
    expect(emitter.count('resetForm')).toBe(1);
  });

  it('se da de baja al desmontar, sin dejar nada colgando del emisor compartido', () => {
    const emitter = createEmitter();
    const { unmount } = render(
      <ClassificationLevels {...propsWith(emitter)} />
    );

    unmount();

    expect(emitter.count('kaceAuthData')).toBe(0);
    expect(emitter.count('redraw')).toBe(0);
    expect(emitter.count('resetForm')).toBe(0);
  });
});
