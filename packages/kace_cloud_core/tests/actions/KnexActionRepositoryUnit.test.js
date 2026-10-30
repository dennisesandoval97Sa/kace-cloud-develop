import { v4 as uuidv4 } from 'uuid';
import { Action, KnexActionRepository } from '../../src/actions/index.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { knexConfig } from '../knexfile.js';
import ActionMother from './domain/ActionMother.js';

describe('KnexActionRepository', () => {
    const repository = new KnexActionRepository(knexConfig);

    describe('save()', () => {
        it('wraps a real Postgres failure (duplicate id) into QueryDBError', async () => {
            const dto = ActionMother.dto();
            const action = Action.create(dto);
            await repository.save(action);

            // Saving the exact same `id` again violates the primary key constraint, so this
            // is a genuine Postgres failure rather than a simulated one.
            await expect(repository.save(Action.create(dto))).rejects.toThrow(QueryDBError);
            await expect(repository.save(Action.create(dto))).rejects.toThrow('Transaction failed: error saving data.');
        });
    });

    describe('findByDescription()', () => {
        it('finds an action whose description contains the search text, case-insensitively', async () => {
            const dto = ActionMother.dto({ description: 'Cierre Automatico De Casos' });
            const action = Action.create(dto);
            await repository.save(action);

            const found = await repository.findByDescription({ value: 'automatico de casos' });

            expect(found).toBeInstanceOf(Action);
            expect(found.id.value).toBe(action.id.value);
        });

        it('returns null when no action description matches', async () => {
            const found = await repository.findByDescription({ value: `no-such-description-${uuidv4()}` });
            expect(found).toBeNull();
        });

        it('wraps a real failure into QueryDBError when description.value is not a string', async () => {
            // `findByDescription` calls `description.value.toLowerCase()` directly, so a
            // description VO whose `.value` isn't a string (here, a number) makes that call
            // throw a real TypeError, which the method's own catch block wraps.
            await expect(repository.findByDescription({ value: 12345 })).rejects.toThrow(QueryDBError);
            await expect(repository.findByDescription({ value: 12345 })).rejects.toThrow(
                'Transaction failed: error retrieving data.'
            );
        });
    });

    describe('getCasoInfo()', () => {
        it('returns null when kase is falsy', async () => {
            const result = await repository.getCasoInfo(null);
            expect(result).toBeNull();
        });

        it('wraps a real failure into QueryDBError when a referenced field is missing entirely', async () => {
            // `getCasoInfo` reads `kase.cliente_id.value` unconditionally; a case-shaped
            // object missing `cliente_id` makes that a real TypeError, not a simulated one.
            const fakeKase = {
                id: { value: uuidv4() },
                clasificacion_id: { value: uuidv4() },
                transicion_id: { value: uuidv4() },
                toJson: () => ({}),
            };

            await expect(repository.getCasoInfo(fakeKase)).rejects.toThrow(QueryDBError);
            await expect(repository.getCasoInfo(fakeKase)).rejects.toThrow(
                'Transaction failed: error retrieving case information.'
            );
        });
    });

    describe('search()', () => {
        it('wraps a real failure into QueryDBError when criteria does not implement convertToKnex', async () => {
            // `search` calls `criteria.convertToKnex(queryBuilder)` unconditionally, so a
            // plain object without that method throws a real TypeError, caught by the
            // method's own catch block.
            await expect(repository.search({})).rejects.toThrow(QueryDBError);
            await expect(repository.search({})).rejects.toThrow('Transaction failed: error executing search.');
        });
    });

    describe('getAuxCasesSchemaId()', () => {
        it('returns null when no aux_definitions row maps "aux_cases" to a schema', async () => {
            await repository.connection('aux_definitions').where({ tablename: 'aux_cases' }).update({
                deleted_at: new Date().toISOString(),
            });

            const schemaId = await repository.getAuxCasesSchemaId();
            expect(schemaId).toBeNull();
        });

        it('wraps a real failure into QueryDBError when the connection is unusable', async () => {
            const brokenRepository = new KnexActionRepository(knexConfig);
            await brokenRepository.connection.destroy();

            // `new QueryDBError('find', 'getSchemaId')` — 'find' is a *known* operation type,
            // so QueryDBError uses its fixed message and silently discards the custom
            // 'getSchemaId' string (only the 'custom' operation type honors it).
            await expect(brokenRepository.getAuxCasesSchemaId()).rejects.toThrow(QueryDBError);
            await expect(brokenRepository.getAuxCasesSchemaId()).rejects.toThrow(
                'Transaction failed: error retrieving data.'
            );
        });
    });
});
