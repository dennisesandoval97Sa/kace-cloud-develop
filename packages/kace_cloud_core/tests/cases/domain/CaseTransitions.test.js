import { CaseTransitions } from '../../../src/cases/domain/CaseTransitions.js';

/**
 * `#getLogin`/`#getGroup`/`#getStates` todos hacen `this.#repository.read.table(...).select(...)
 * ...first()`; un stub encadenable genérico basta porque a `execute()` no le importa qué campos
 * pidió cada consulta, solo la fila que vuelve.
 */
function makeRepository({ user = {}, group = {}, states = {} } = {}) {
    const chain = (result) => {
        const builder = {
            select: () => builder,
            where: () => builder,
            leftJoin: () => builder,
            first: async () => result,
        };
        return builder;
    };

    let call = 0;
    return {
        qualifiedName: (name) => name,
        read: {
            table: (tableName) => {
                call += 1;
                if (tableName === 'usuarios') return chain(user);
                if (tableName === 'grupos') return chain(group);
                if (tableName === 'transiciones') return chain(states);
                return chain(null);
            },
        },
        _callCount: () => call,
    };
}

describe('CaseTransitions', () => {
    const originalAttributes = { transicion_id: 't-1', grupo_id: 'g-1', responsable_id: 'u-1' };
    const newAttributes = {
        transicion_id: 't-1',
        grupo_id: 'g-1',
        responsable_id: 'u-1',
        updated_at: '2026-09-21T00:00:00.000Z',
    };

    it('resuelve estado_actual/estado_siguiente consultando la transición cuando includeState no se pasa (default true)', async () => {
        const repository = makeRepository({
            user: { login: 'agente1' },
            group: { nombre: 'Grupo 1' },
            states: { estado_actual: 'Abierto', siguiente_estado: 'Rechazado' },
        });

        const result = await new CaseTransitions(repository).execute(originalAttributes, newAttributes);

        expect(result.estado_actual).toBe('Abierto');
        expect(result.estado_siguiente).toBe('Rechazado');
        expect(result.es_reclasificacion).toBe(false);
    });

    /**
     * Cuando un mismo guardado reclasifica Y cambia de estado, el repositorio pide DOS entradas
     * de timeline a partir de ese único registro: una de reclasificación (sin estado, para no
     * mezclarla con el cambio de estado) y otra normal con el estado resultante. `includeState:
     * false` es el interruptor que hace posible la primera sin tocar `#getStates`.
     */
    it('con includeState=false no consulta el estado y lo deja en null', async () => {
        const repository = makeRepository({
            user: { login: 'agente1' },
            group: { nombre: 'Grupo 1' },
            states: { estado_actual: 'Abierto', siguiente_estado: 'Rechazado' },
        });

        const result = await new CaseTransitions(repository).execute(
            originalAttributes,
            newAttributes,
            null,
            null,
            { reasonCommentId: null, reason: 'Motivo' },
            { includeState: false }
        );

        expect(result.estado_actual).toBeNull();
        expect(result.estado_siguiente).toBeNull();
        expect(result.es_reclasificacion).toBe(true);
        expect(result.motivo_reclasificacion).toBe('Motivo');
    });

    it('con includeState=true (o sin la opción) sí resuelve el estado aunque también sea reclasificación', async () => {
        const repository = makeRepository({
            user: { login: 'agente1' },
            group: { nombre: 'Grupo 1' },
            states: { estado_actual: 'Abierto', siguiente_estado: 'Rechazado' },
        });

        const result = await new CaseTransitions(repository).execute(originalAttributes, newAttributes, null, null, {
            reasonCommentId: null,
            reason: null,
        });

        expect(result.estado_actual).toBe('Abierto');
        expect(result.estado_siguiente).toBe('Rechazado');
        expect(result.es_reclasificacion).toBe(true);
    });
});
