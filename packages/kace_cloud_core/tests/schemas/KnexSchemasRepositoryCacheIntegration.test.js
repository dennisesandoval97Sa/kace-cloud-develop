import { KnexSchemasRepository } from '../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';
import { SchemasMother } from './domain/SchemasMother.js';

describe('KnexSchemasRepository cache', () => {
    const repository = new KnexSchemasRepository(knexConfig);

    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns the same cached instance on second find', async () => {
        const id = { value: '00000000-0000-0000-0000-000000000001' };

        const first = await repository.find(id);
        const second = await repository.find(id);

        expect(second).toBe(first);
    });

    describe('getSchemaRules cache', () => {
        it('returns the same cached instance on second getSchemaRules call', async () => {
            const schema = await SchemasMother.create({}, repository);
            const id = { value: schema.id.value };

            const first = await repository.getSchemaRules(id);
            const second = await repository.getSchemaRules(id);

            expect(first).not.toBeNull();
            expect(second).toBe(first);
        });

        it('invalidates the getSchemaRules cache when the schema is updated', async () => {
            const schema = await SchemasMother.create({}, repository);
            const id = { value: schema.id.value };

            const first = await repository.getSchemaRules(id);
            await repository.update(schema);
            const afterUpdate = await repository.getSchemaRules(id);

            expect(afterUpdate).not.toBe(first);
        });

        it('invalidates a parent getSchemaRules cache when a nested child schema changes', async () => {
            const child = await SchemasMother.create({}, repository);
            const parent = await SchemasMother.create(
                { data_structure: { items: { type: 'array', required: false, schema_id: child.id.value } } },
                repository
            );
            const parentId = { value: parent.id.value };

            const first = await repository.getSchemaRules(parentId);
            await repository.update(child);
            const afterChildUpdate = await repository.getSchemaRules(parentId);

            expect(afterChildUpdate).not.toBe(first);
        });
    });
});
