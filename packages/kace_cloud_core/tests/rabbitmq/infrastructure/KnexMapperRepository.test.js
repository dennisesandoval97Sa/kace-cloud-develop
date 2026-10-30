import { v4 as uuidv4 } from 'uuid';
import { KnexMapperRepository } from '../../../src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { Criteria } from '../../../src/shared/criteria/Criteria.js';
import { knexConfig } from '../../knexfile.js';
import MapperMother from '../domain/MapperMother.js';

describe('KnexMapperRepository', () => {
    const repository = new KnexMapperRepository(knexConfig);

    describe('create()', () => {
        it('skips the rules INSERT entirely when rules is an empty array', async () => {
            const dto = MapperMother.dto({ rules: [] });

            await repository.create(dto);

            const stored = await repository.findById(dto.id);
            expect(stored.rules).toEqual([]);
        });

        it('inserts rules when rules is a non-empty array, preserving each field value', async () => {
            const dto = MapperMother.dto();
            const expectedRule = dto.rules[0];

            await repository.create(dto);

            const stored = await repository.findById(dto.id);
            expect(stored.rules).toHaveLength(1);
            expect(stored.rules[0]).toMatchObject({
                id: expectedRule.id,
                target_entity: expectedRule.target_entity,
                target_field: expectedRule.target_field,
                source_field: expectedRule.source_field,
            });
        });
    });

    describe('update()', () => {
        it('treats a missing changes object as empty (no mapper-level UPDATE, no rules touched)', async () => {
            const dto = MapperMother.dto();
            await repository.create(dto);

            const result = await repository.update(dto.id, undefined);

            expect(result).toEqual({ id: dto.id });
            const stored = await repository.findById(dto.id);
            expect(stored.name).toBe(dto.name);
            expect(stored.rules).toHaveLength(1);
        });

        it('skips the mapper-level UPDATE when changes has no top-level fields (rules-only changes)', async () => {
            const dto = MapperMother.dto({ name: 'KeepThisName' });
            await repository.create(dto);
            const newRuleId = uuidv4();

            await repository.update(dto.id, { rules: [{ ...MapperMother.ruleDto({ id: newRuleId }) }] });

            const stored = await repository.findById(dto.id);
            expect(stored.name).toBe('KeepThisName');
            expect(stored.rules.map((r) => r.id)).toEqual([newRuleId]);
        });

        it('does not touch rules at all when changes.rules is omitted', async () => {
            const dto = MapperMother.dto();
            await repository.create(dto);

            await repository.update(dto.id, { name: 'OnlyNameChanged' });

            const stored = await repository.findById(dto.id);
            expect(stored.name).toBe('OnlyNameChanged');
            expect(stored.rules).toHaveLength(1);
        });

        it('does not delete any existing rule when every existing id is kept in the incoming rules', async () => {
            const existingRuleId = uuidv4();
            const dto = MapperMother.dto({ rules: [MapperMother.ruleDto({ id: existingRuleId })] });
            await repository.create(dto);

            await repository.update(dto.id, {
                rules: [{ ...MapperMother.ruleDto({ id: existingRuleId }), target_field: 'changed' }],
            });

            const stored = await repository.findById(dto.id);
            expect(stored.rules).toHaveLength(1);
            expect(stored.rules[0].id).toBe(existingRuleId);
            expect(stored.rules[0].target_field).toBe('changed');
        });

        it('generates a random id for an inserted rule that has no id, and defaults a missing parse_to to null', async () => {
            const dto = MapperMother.dto({ rules: [] });
            await repository.create(dto);
            const ruleWithoutId = MapperMother.ruleDto();
            delete ruleWithoutId.id;
            delete ruleWithoutId.parse_to;

            await repository.update(dto.id, { rules: [ruleWithoutId] });

            const stored = await repository.findById(dto.id);
            expect(stored.rules).toHaveLength(1);
            expect(stored.rules[0].id).toEqual(expect.any(String));
            expect(stored.rules[0].id).not.toBe('');
            expect(stored.rules[0].parse_to).toBeNull();
        });

        it('inserts a new rule with an explicit parse_to when provided', async () => {
            const dto = MapperMother.dto({ rules: [] });
            await repository.create(dto);
            const ruleWithParseTo = MapperMother.ruleDto({ id: uuidv4() });
            ruleWithParseTo.parse_to = 'number';

            await repository.update(dto.id, { rules: [ruleWithParseTo] });

            const stored = await repository.findById(dto.id);
            expect(stored.rules[0].parse_to).toBe('number');
        });

        it('deletes an existing rule whose id is not present in the incoming rules', async () => {
            const keptId = uuidv4();
            const removedId = uuidv4();
            const dto = MapperMother.dto({
                rules: [MapperMother.ruleDto({ id: keptId }), MapperMother.ruleDto({ id: removedId })],
            });
            await repository.create(dto);

            await repository.update(dto.id, { rules: [MapperMother.ruleDto({ id: keptId })] });

            const stored = await repository.findById(dto.id);
            expect(stored.rules.map((r) => r.id)).toEqual([keptId]);
        });

        it('updates an existing rule (matched by id) and defaults its parse_to to null when omitted', async () => {
            const ruleId = uuidv4();
            const dto = MapperMother.dto({ rules: [MapperMother.ruleDto({ id: ruleId, parse_to: 'string' })] });
            await repository.create(dto);

            const updatedRule = MapperMother.ruleDto({ id: ruleId, target_field: 'updated-field' });
            delete updatedRule.parse_to;
            await repository.update(dto.id, { rules: [updatedRule] });

            const stored = await repository.findById(dto.id);
            expect(stored.rules).toHaveLength(1);
            expect(stored.rules[0].target_field).toBe('updated-field');
            expect(stored.rules[0].parse_to).toBeNull();
        });

        it('updates an existing rule keeping an explicit parse_to', async () => {
            const ruleId = uuidv4();
            const dto = MapperMother.dto({ rules: [MapperMother.ruleDto({ id: ruleId, parse_to: null })] });
            await repository.create(dto);

            const updatedRule = MapperMother.ruleDto({ id: ruleId, parse_to: 'boolean' });
            await repository.update(dto.id, { rules: [updatedRule] });

            const stored = await repository.findById(dto.id);
            expect(stored.rules[0].parse_to).toBe('boolean');
        });
    });

    describe('search()', () => {
        it('applies criteria.convertToKnex when the criteria provides it', async () => {
            const dto = MapperMother.dto({ name: `Searchable-${uuidv4()}` });
            await repository.create(dto);
            const criteria = new Criteria(
                [{ field: 'name', operator: 'eq', value: dto.name, type: 'AND' }],
                undefined,
                10,
                0,
                undefined,
                'broker_message_mappers'
            );

            const results = await repository.search(criteria);

            expect(results).toHaveLength(1);
            expect(results[0].name).toBe(dto.name);
        });

        it('falls back to the base query when criteria has no convertToKnex (returns every non-deleted mapper)', async () => {
            const dto = MapperMother.dto({ name: `NoConvert-${uuidv4()}` });
            await repository.create(dto);

            const results = await repository.search({});

            expect(results.some((m) => m.name === dto.name)).toBe(true);
        });
    });

    describe('count()', () => {
        it('applies criteria.convertToKnex when the criteria provides it', async () => {
            const dto = MapperMother.dto({ name: `CountMe-${uuidv4()}` });
            await repository.create(dto);
            const criteria = new Criteria(
                [{ field: 'name', operator: 'eq', value: dto.name, type: 'AND' }],
                undefined,
                10,
                0,
                undefined,
                'broker_message_mappers'
            );

            const count = await repository.count(criteria);

            expect(count).toBe(1);
        });

        it('falls back to the base query when criteria has no convertToKnex (counts every non-deleted mapper)', async () => {
            const before = await repository.count({});
            await repository.create(MapperMother.dto({ name: `CountAll-A-${uuidv4()}` }));
            await repository.create(MapperMother.dto({ name: `CountAll-B-${uuidv4()}` }));

            const count = await repository.count({});

            // Contra la consulta directa: la rama sin `convertToKnex` tiene que devolver
            // EXACTAMENTE las filas no borradas, no un numero cualquiera >= 0.
            const [{ count: direct }] = await repository
                .connection('broker_message_mappers')
                .whereNull('deleted_by')
                .count({ count: '*' });

            expect(typeof count).toBe('number');
            expect(count).toBe(Number(direct));
            expect(count).toBe(before + 2);
        });

        // NOTA sobre 2 ramas inalcanzables en count() (KnexMapperRepository.js:147-148):
        // `const num = typeof count === 'string' ? parseInt(count, 10) : count;` y
        // `return num ?? 0;`. El driver `pg` (node-postgres) devuelve SIEMPRE los agregados
        // COUNT(*) (bigint/OID 20) como STRING -- no como number -- para no perder precision en
        // valores > 2^53, y este proyecto no registra un `pg.types.setTypeParser` que lo
        // reinterprete (se comprobo: no hay ninguna llamada a setTypeParser en todo el
        // monorepo salvo un caso no relacionado con conteos, en kace_cloud_db_sync). Por tanto
        // `typeof count === 'string'` es SIEMPRE verdadero en la ruta real hacia Postgres: la
        // rama `: count` (ya-numero) es codigo muerto. Y como `count` es siempre una cadena de
        // digitos validos, `parseInt(count, 10)` nunca produce `NaN`/nullish, asi que `num` nunca
        // es nullish y el fallback `?? 0` tampoco es alcanzable. Se documenta, no se fuerza con
        // un stub que sustituya la respuesta real de la base de datos.
    });
});
