import { v4 as uuidv4 } from 'uuid';
import { Mapper } from '../../../src/rabbitmq/domain/Mapper.js';
import MapperMother from './MapperMother.js';

describe('Mapper', () => {
    describe('constructor', () => {
        it('applies the documented defaults (rules, created_at, updated_at) when omitted', () => {
            const mapper = new Mapper({ id: uuidv4(), name: 'Test', queue: 'q1', rest_flow_id: uuidv4() });

            expect(mapper.rules).toEqual([]);
            expect(mapper.created_at).toBeNull();
            expect(mapper.updated_at).toBeNull();
        });

        it('keeps explicit rules/created_at/updated_at instead of falling back to defaults', () => {
            const rules = [{ id: uuidv4(), target_entity: 'cases', target_field: 'reference' }];
            const mapper = new Mapper({
                id: uuidv4(),
                name: 'Test',
                queue: 'q1',
                rest_flow_id: uuidv4(),
                rules,
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-02-01T00:00:00.000Z',
            });

            expect(mapper.rules).toBe(rules);
            expect(mapper.created_at).toBe('2026-01-01T00:00:00.000Z');
            expect(mapper.updated_at).toBe('2026-02-01T00:00:00.000Z');
        });

        it('leaves id as null when id is explicitly null (not just when omitted)', () => {
            const mapper = new Mapper({ id: null, name: 'Test', queue: 'q1', rest_flow_id: uuidv4() });

            expect(mapper.id).toBeNull();
        });

        it('sets id from a valid uuid when id is provided', () => {
            const id = uuidv4();
            const mapper = new Mapper({ id, name: 'Test', queue: 'q1', rest_flow_id: uuidv4() });

            expect(mapper.id).toBe(id);
        });

        it('normalizes a non-array rules value to an empty array', () => {
            const mapper = new Mapper({
                id: uuidv4(),
                name: 'Test',
                queue: 'q1',
                rest_flow_id: uuidv4(),
                rules: 'not-an-array',
            });

            expect(mapper.rules).toEqual([]);
        });
    });

    describe('create()', () => {
        it('builds a Mapper from a valid dto', () => {
            const dto = MapperMother.dto();

            const mapper = Mapper.create(dto);

            expect(mapper).toBeInstanceOf(Mapper);
            expect(mapper.name).toBe(dto.name);
            expect(mapper.rest_flow_id).toBe(dto.rest_flow_id);
            expect(mapper.rules).toBe(dto.rules);
        });

        it('throws when dto is missing entirely', () => {
            expect(() => Mapper.create(undefined)).toThrow('Mapper invalid: dto is required');
        });

        it('throws when name is missing', () => {
            const dto = MapperMother.dto();
            delete dto.name;

            expect(() => Mapper.create(dto)).toThrow('Mapper invalid: name is required');
        });

        it('throws when rest_flow_id is missing', () => {
            const dto = MapperMother.dto();
            delete dto.rest_flow_id;

            expect(() => Mapper.create(dto)).toThrow('Mapper invalid: rest_flow_id is required');
        });

        it('throws when rules is not an array', () => {
            const dto = MapperMother.dto({ rules: 'not-an-array' });

            expect(() => Mapper.create(dto)).toThrow('Mapper invalid: rules must be an array');
        });
    });
});
