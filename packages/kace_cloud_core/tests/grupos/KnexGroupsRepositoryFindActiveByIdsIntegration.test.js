import { v4 as uuid } from 'uuid';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

// `grupos.horario_id` apunta a `shift_management`. Un uuid distinto por fila
// obligaria a respaldar tantos horarios como grupos, y ninguno de estos tests
// mira el horario: uno solo, compartido y garantizado en el beforeEach, basta.
const HORARIO_ID = '00000000-0000-4000-8000-0000000000a1';

function groupRow(override = {}) {
    return {
        horario_id: HORARIO_ID,
        nombre: 'Grupo Fixture',
        status: 1,
        created_by: uuid(),
        created_at: new Date(),
        ...override,
    };
}

describe('KnexGroupsRepository.findActiveByIds + countActive + findByIds', () => {
    const knex = knexConfig;
    const repo = new KnexGroupsRepository(knex);

    beforeEach(async () => {
        await knex.raw('TRUNCATE TABLE grupos CASCADE');
        // El reset por test repone `shift_management` desde la plantilla, asi
        // que la fila padre hay que garantizarla en cada `it`, no una vez.
        await ensureParentRow(knex, 'shift_management', HORARIO_ID);
    });

    it('findActiveByIds returns only active (status=1), non-deleted groups among the given ids', async () => {
        const a = uuid(),
            b = uuid(),
            c = uuid(),
            d = uuid();
        await knex('grupos').insert([
            groupRow({ id: a, nombre: 'Grupo Alfa', status: 1 }),
            groupRow({ id: b, nombre: 'Grupo Beta', status: 2 }),
            groupRow({ id: c, nombre: 'Grupo Gama', status: 1, deleted_at: new Date() }),
            groupRow({ id: d, nombre: 'Grupo Delta', status: 1 }),
        ]);
        const result = await repo.findActiveByIds([a, b, c, d]);
        const ids = result.map((g) => g.id.value).sort();
        expect(ids).toEqual([a, d].sort());
    });

    it('countActive returns the count of active, non-deleted groups', async () => {
        const a = uuid(),
            b = uuid();
        await knex('grupos').insert([
            groupRow({ id: a, nombre: 'Grupo Alfa', status: 1 }),
            groupRow({ id: b, nombre: 'Grupo Beta', status: 2 }),
        ]);
        const count = await repo.countActive();
        expect(count).toBe(1);
    });

    it('findByIds returns groups regardless of status (used by UserContextBatchLoader)', async () => {
        const a = uuid(),
            b = uuid();
        await knex('grupos').insert([
            groupRow({ id: a, nombre: 'Grupo Alfa', status: 1 }),
            groupRow({ id: b, nombre: 'Grupo Beta', status: 2 }),
        ]);
        const result = await repo.findByIds([a, b]);
        expect(result.map((g) => g.id.value).sort()).toEqual([a, b].sort());
    });

    it('findByIds excludes soft-deleted groups', async () => {
        const a = uuid(),
            b = uuid();
        await knex('grupos').insert([
            groupRow({ id: a, nombre: 'Grupo Alfa', status: 1 }),
            groupRow({ id: b, nombre: 'Grupo Beta', status: 1, deleted_at: new Date() }),
        ]);
        const result = await repo.findByIds([a, b]);
        expect(result.map((g) => g.id.value)).toEqual([a]);
    });
});
