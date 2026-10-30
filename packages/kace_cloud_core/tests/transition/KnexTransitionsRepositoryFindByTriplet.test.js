import { v4 as uuidv4 } from 'uuid';
import { KnexTransitionsRepository } from '../../src/transition';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';
import { TransitionsMother } from './domain/TransitionsMother.js';

const repository = new KnexTransitionsRepository(knexConfig);

describe('KnexTransitionsRepository.findByFlowAndTriplet', () => {
    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns null when no transition matches the tripleta', async () => {
        const result = await repository.findByFlowAndTriplet(uuidv4(), uuidv4(), uuidv4());
        expect(result).toBeNull();
    });

    it('returns the most recent transition matching the tripleta', async () => {
        const flujoId = uuidv4();
        const estadoActualId = uuidv4();
        const siguienteEstadoId = uuidv4();

        const older = {
            id: uuidv4(),
            estado_actual_id: estadoActualId,
            siguiente_estado_id: siguienteEstadoId,
            flujo_id: flujoId,
            status: 1,
            ans_id: null,
            rule_id: null,
            is_visible: true,
            created_at: new Date(Date.now() - 60_000).toISOString(),
            created_by: uuidv4(),
        };
        const newer = {
            ...older,
            id: uuidv4(),
            ans_id: uuidv4(),
            created_at: new Date().toISOString(),
        };

        await TransitionsMother.ensureRelations(repository.connection, older, {});
        await repository.table().insert(older);
        await repository.table().insert(newer);

        const result = await repository.findByFlowAndTriplet(flujoId, estadoActualId, siguienteEstadoId);

        expect(result).not.toBeNull();
        expect(result.id.value).toBe(newer.id);
        expect(result.ans_id.value).toBe(newer.ans_id);

        await repository.table().whereIn('id', [older.id, newer.id]).del();
    });

    it('handles a null estado_actual_id (initial edges)', async () => {
        const flujoId = uuidv4();
        const siguienteEstadoId = uuidv4();

        const transition = {
            id: uuidv4(),
            estado_actual_id: null,
            siguiente_estado_id: siguienteEstadoId,
            flujo_id: flujoId,
            status: 1,
            ans_id: null,
            rule_id: null,
            is_visible: true,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };

        await TransitionsMother.ensureRelations(repository.connection, transition, {});
        await repository.table().insert(transition);

        const result = await repository.findByFlowAndTriplet(flujoId, null, siguienteEstadoId);

        expect(result).not.toBeNull();
        expect(result.id.value).toBe(transition.id);

        await repository.table().where('id', transition.id).del();
    });
});
