import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { knexConfig } from '../../../knexfile.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import { v4 as uuidv4 } from 'uuid';

describe('KnexCaseRepository.bulkUpdateSlaTimers', () => {
    const repository = new KnexCaseRepository(knexConfig);

    it('returns without executing SQL when updates is empty', async () => {
        await expect(repository.bulkUpdateSlaTimers([])).resolves.toBeUndefined();
    });

    it('updates a single case across multiple SLA columns', async () => {
        const kase = await CasesMother.createCase(repository, {});

        const dueDateIso = '2026-12-01T10:00:00.000Z';

        await repository.bulkUpdateSlaTimers([
            {
                id: kase.id.value,
                changedAttributes: {
                    sla_due_date: dueDateIso,
                    sla_remaining_time: '2 days',
                    sla_elapsed_time: '1 day',
                },
            },
        ]);

        const [row] = await repository.connection('cases').select('*').where('id', kase.id.value);
        // `sla_due_date` es timestamp: el driver de pg lo devuelve como Date, no como cadena.
        expect(row.sla_due_date.toISOString()).toBe(dueDateIso);
        expect(row.sla_remaining_time).toBe('2 days');
        expect(row.sla_elapsed_time).toBe('1 day');
    });

    it('does not touch rows whose id is not in updates', async () => {
        const a = await CasesMother.createCase(repository, {});
        const b = await CasesMother.createCase(repository, {});

        // Seed initial SLA values directly since save() does not persist them.
        await repository.connection('cases').where('id', a.id.value).update({ sla_elapsed_time: 'original-A' });
        await repository.connection('cases').where('id', b.id.value).update({ sla_elapsed_time: 'original-B' });

        await repository.bulkUpdateSlaTimers([
            { id: a.id.value, changedAttributes: { sla_elapsed_time: 'updated-A' } },
        ]);

        const [rowA] = await repository.connection('cases').select('sla_elapsed_time').where('id', a.id.value);
        const [rowB] = await repository.connection('cases').select('sla_elapsed_time').where('id', b.id.value);
        expect(rowA.sla_elapsed_time).toBe('updated-A');
        expect(rowB.sla_elapsed_time).toBe('original-B');
    });

    it('refuses to write soft-deleted rows even when their id is listed', async () => {
        const kase = await CasesMother.createCase(repository, {});

        // Seed initial SLA value directly since save() does not persist it.
        await repository
            .connection('cases')
            .where('id', kase.id.value)
            .update({ sla_elapsed_time: 'original', deleted_at: new Date() });

        await repository.bulkUpdateSlaTimers([
            { id: kase.id.value, changedAttributes: { sla_elapsed_time: 'should-not-apply' } },
        ]);

        const [row] = await repository.connection('cases').select('sla_elapsed_time').where('id', kase.id.value);
        expect(row.sla_elapsed_time).toBe('original');
    });

    it('rejects any attempt to write a column outside the SLA whitelist', async () => {
        const kase = await CasesMother.createCase(repository, {});

        await expect(
            repository.bulkUpdateSlaTimers([{ id: kase.id.value, changedAttributes: { titulo: 'malicious' } }])
        ).rejects.toThrow(/SLA_UPDATABLE_COLUMNS/);
    });

    it('applies distinct column values to each case in a multi-row batch', async () => {
        const a = await CasesMother.createCase(repository, {});
        const b = await CasesMother.createCase(repository, {});
        // Seed pre-condition values via direct DB writes to bypass Mother limitations.
        await repository.connection('cases').where('id', a.id.value).update({
            sla_elapsed_time: 'before-A',
            sla_remaining_time: 'rem-A',
        });
        await repository.connection('cases').where('id', b.id.value).update({
            sla_elapsed_time: 'before-B',
            sla_remaining_time: 'rem-B',
        });

        await repository.bulkUpdateSlaTimers([
            { id: a.id.value, changedAttributes: { sla_elapsed_time: 'after-A' } },
            { id: b.id.value, changedAttributes: { sla_elapsed_time: 'after-B' } },
        ]);

        const rows = await repository
            .connection('cases')
            .select('id', 'sla_elapsed_time', 'sla_remaining_time')
            .whereIn('id', [a.id.value, b.id.value]);

        const rowA = rows.find((r) => r.id === a.id.value);
        const rowB = rows.find((r) => r.id === b.id.value);

        expect(rowA.sla_elapsed_time).toBe('after-A');
        expect(rowB.sla_elapsed_time).toBe('after-B');
        // Untouched columns preserve their seed values (CASE … ELSE col END).
        expect(rowA.sla_remaining_time).toBe('rem-A');
        expect(rowB.sla_remaining_time).toBe('rem-B');
    });

    it('updates 50 heterogeneous cases (each touching a different subset of columns) in one call', async () => {
        const cases = [];
        for (let i = 0; i < 50; i++) {
            cases.push(await CasesMother.createCase(repository, {}));
        }
        // Seed pre-condition values directly (CasesMother does not accept SLA keys).
        await Promise.all(
            cases.map((kase, i) =>
                repository
                    .connection('cases')
                    .where('id', kase.id.value)
                    .update({
                        sla_elapsed_time: `init-${i}`,
                        sla_remaining_time: `rem-${i}`,
                    })
            )
        );

        // Even indices update sla_elapsed_time only; odd indices update sla_remaining_time only.
        const updates = cases.map((kase, i) => ({
            id: kase.id.value,
            changedAttributes: i % 2 === 0 ? { sla_elapsed_time: `new-${i}` } : { sla_remaining_time: `new-rem-${i}` },
        }));

        await repository.bulkUpdateSlaTimers(updates);

        const rows = await repository
            .connection('cases')
            .select('id', 'sla_elapsed_time', 'sla_remaining_time')
            .whereIn(
                'id',
                cases.map((c) => c.id.value)
            );

        const byId = new Map(rows.map((r) => [r.id, r]));
        cases.forEach((kase, i) => {
            const row = byId.get(kase.id.value);
            if (i % 2 === 0) {
                expect(row.sla_elapsed_time).toBe(`new-${i}`);
                expect(row.sla_remaining_time).toBe(`rem-${i}`); // untouched
            } else {
                expect(row.sla_elapsed_time).toBe(`init-${i}`); // untouched
                expect(row.sla_remaining_time).toBe(`new-rem-${i}`);
            }
        });
    }, 60000);

    it('sub-partitions internally when given more than 2500 updates', async () => {
        // 3000 casos son al menos 2 sub-tandas internas. Crearlos uno a uno con la factoria
        // tardaba minutos (cada uno es un save mas su fila de historial) y agotaba el timeout
        // bajo contencion del pool: se crea uno de verdad y el resto se clona en bloque, que es
        // lo unico que necesita este test. `reference` se omite porque es SERIAL y unica.
        const seed = await CasesMother.createCase(repository, {});
        const [template] = await repository.connection('cases').select('*').where('id', seed.id.value);
        delete template.reference;

        const cases = [{ id: { value: seed.id.value } }];
        const clones = [];
        for (let i = 1; i < 3000; i++) {
            const id = uuidv4();
            cases.push({ id: { value: id } });
            clones.push({ ...template, id });
        }
        await repository.connection.batchInsert('cases', clones, 500);

        const updates = cases.map((kase, i) => ({
            id: kase.id.value,
            changedAttributes: { sla_elapsed_time: `done-${i}` },
        }));

        await repository.bulkUpdateSlaTimers(updates);

        const rows = await repository
            .connection('cases')
            .count({ count: '*' })
            .whereIn(
                'id',
                cases.map((c) => c.id.value)
            )
            .where('sla_elapsed_time', 'like', 'done-%');
        expect(Number(rows[0].count)).toBe(3000);
    }, 120000);
});
