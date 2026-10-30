import { MapperRule } from '../../../src/rabbitmq/domain/MapperRule.js';
import { CustomError } from '../../../src/shared/index.js';

describe('MapperRule Domain', () => {
    test('create should throw when dto missing', () => {
        expect(() => MapperRule.create()).toThrow(CustomError);
    });

    test('create should throw when required fields missing', () => {
        expect(() => MapperRule.create({ mapper_id: 'm1' })).toThrow(CustomError);
        expect(() =>
            MapperRule.create({ mapper_id: 'm1', target_entity: 'case', target_field: 'reference' })
        ).toThrow(CustomError);
    });

    test('create should succeed with valid dto', () => {
        const dto = {
            id: '1',
            mapper_id: 'mapper-1',
            target_entity: 'case',
            target_field: 'reference',
            source_field: 'payload.id',
        };
        const rule = MapperRule.create(dto);
        expect(rule).toBeInstanceOf(MapperRule);
        expect(rule.target_entity).toBe('case');
        expect(rule.target_field).toBe('reference');
        expect(rule.source_field).toBe('payload.id');
    });
});
