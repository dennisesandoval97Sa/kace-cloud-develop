import { KnexSchemasRepository } from '../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';
import { SchemasMother } from './domain/SchemasMother.js';

describe('KnexSchemasRepository.getSchemaRules batched resolution (real DB)', () => {
    const repository = new KnexSchemasRepository(knexConfig);

    beforeEach(() => {
        EntityCache.clear();
    });

    const countSchemaSelects = async (fn) => {
        let count = 0;
        const listener = (query) => {
            if (/select/i.test(query.sql) && /schemas/i.test(query.sql)) {
                count += 1;
            }
        };
        repository.connection.on('query', listener);
        try {
            return [await fn(), count];
        } finally {
            repository.connection.removeListener('query', listener);
        }
    };

    it('resolves N sibling child schemas without an N+1 (bounded query count)', async () => {
        const childA = await SchemasMother.create({}, repository);
        const childB = await SchemasMother.create({}, repository);
        const childC = await SchemasMother.create({}, repository);
        const childD = await SchemasMother.create({}, repository);
        const root = await SchemasMother.create(
            {
                data_structure: {
                    a: { type: 'array', required: false, schema_id: childA.id.value },
                    b: { type: 'array', required: false, schema_id: childB.id.value },
                    c: { type: 'array', required: false, schema_id: childC.id.value },
                    d: { type: 'array', required: false, schema_id: childD.id.value },
                },
            },
            repository
        );
        EntityCache.clear();

        const [result, queries] = await countSchemaSelects(() => repository.getSchemaRules({ value: root.id.value }));

        // correctness: every sibling child got resolved
        const ds = result.data_structure.value;
        expect(ds.a.data_structure).toBeDefined();
        expect(ds.b.data_structure).toBeDefined();
        expect(ds.c.data_structure).toBeDefined();
        expect(ds.d.data_structure).toBeDefined();

        // efficiency: root + one batched IN for the 4 siblings, not 1 + 4 serial round-trips
        expect(queries).toBeLessThanOrEqual(3);
    });

    it('resolves a 3-level deep nesting and stays bounded by depth, not node count', async () => {
        const grandchild = await SchemasMother.create({}, repository);
        const child = await SchemasMother.create(
            { data_structure: { gc: { type: 'array', required: false, schema_id: grandchild.id.value } } },
            repository
        );
        const root = await SchemasMother.create(
            { data_structure: { ch: { type: 'object', required: false, schema_id: child.id.value } } },
            repository
        );
        EntityCache.clear();

        const [result, queries] = await countSchemaSelects(() => repository.getSchemaRules({ value: root.id.value }));

        const ds = result.data_structure.value;
        expect(ds.ch.data_structure).toBeDefined();
        expect(ds.ch.data_structure.gc.data_structure).toBeDefined();
        expect(ds.ch.data_structure.gc.data_structure.campo1).toBeDefined();

        // root + one IN per nesting level (2 levels) = 3, not 1-per-node
        expect(queries).toBeLessThanOrEqual(3);
    });

    it('does not loop forever on a self-referencing schema (cycle guard)', async () => {
        const selfId = '11111111-1111-4111-8111-111111111111';
        await SchemasMother.create(
            {
                id: selfId,
                data_structure: { self: { type: 'array', required: false, schema_id: selfId } },
            },
            repository
        );
        EntityCache.clear();

        const result = await repository.getSchemaRules({ value: selfId });

        expect(result).not.toBeNull();
        // the self-reference is cut: no infinite expansion under data_structure
        expect(result.data_structure.value.self.data_structure).toBeUndefined();
    });
});
