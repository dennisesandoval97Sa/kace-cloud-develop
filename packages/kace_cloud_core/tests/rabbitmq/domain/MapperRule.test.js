import { v4 as uuidv4 } from 'uuid';
import { MapperRule } from '../../../src/rabbitmq/domain/MapperRule.js';
import MapperMother from './MapperMother.js';

describe('MapperRule', () => {
    describe('constructor', () => {
        it('sets id from a valid uuid when id is provided', () => {
            const id = uuidv4();
            const rule = new MapperRule({
                id,
                mapper_id: uuidv4(),
                target_entity: 'cases',
                target_field: 'reference',
                source_field: 'payload.ref',
            });

            expect(rule.id).toBe(id);
        });

        it('leaves id as null when id is explicitly null (not just when omitted)', () => {
            const rule = new MapperRule({
                id: null,
                mapper_id: uuidv4(),
                target_entity: 'cases',
                target_field: 'reference',
                source_field: 'payload.ref',
            });

            expect(rule.id).toBeNull();
        });

        it('leaves id as null when id is omitted (undefined)', () => {
            const rule = new MapperRule({
                mapper_id: uuidv4(),
                target_entity: 'cases',
                target_field: 'reference',
                source_field: 'payload.ref',
            });

            expect(rule.id).toBeNull();
        });
    });

    describe('create()', () => {
        it('builds a MapperRule from a valid dto', () => {
            const dto = MapperMother.ruleDto();

            const rule = MapperRule.create({ ...dto, mapper_id: uuidv4() });

            expect(rule).toBeInstanceOf(MapperRule);
            expect(rule.target_entity).toBe(dto.target_entity);
            expect(rule.target_field).toBe(dto.target_field);
            expect(rule.source_field).toBe(dto.source_field);
        });

        it('throws when dto is missing entirely', () => {
            expect(() => MapperRule.create(undefined)).toThrow('MapperRule invalid: dto is required');
        });

        it('throws when mapper_id is missing', () => {
            const dto = { target_entity: 'cases', target_field: 'reference', source_field: 'payload.ref' };

            expect(() => MapperRule.create(dto)).toThrow('MapperRule invalid: mapper_id is required');
        });

        it('throws when target_entity is missing', () => {
            const dto = { mapper_id: uuidv4(), target_field: 'reference', source_field: 'payload.ref' };

            expect(() => MapperRule.create(dto)).toThrow('MapperRule invalid: target_entity is required');
        });

        it('throws when target_field is missing', () => {
            const dto = { mapper_id: uuidv4(), target_entity: 'cases', source_field: 'payload.ref' };

            expect(() => MapperRule.create(dto)).toThrow('MapperRule invalid: target_field is required');
        });

        it('throws when source_field is missing', () => {
            const dto = { mapper_id: uuidv4(), target_entity: 'cases', target_field: 'reference' };

            expect(() => MapperRule.create(dto)).toThrow('MapperRule invalid: source_field is required');
        });
    });
});
