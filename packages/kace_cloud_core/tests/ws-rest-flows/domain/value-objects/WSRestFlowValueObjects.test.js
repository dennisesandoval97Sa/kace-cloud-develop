import { ValueObjectDescription } from '../../../../src/ws-rest-flows/domain/value-objects/ValueObjectDescription.js';
import { ValueObjectExternalCode } from '../../../../src/ws-rest-flows/domain/value-objects/ValueObjectExternalCode.js';
import { ValueObjectInitialContext } from '../../../../src/ws-rest-flows/domain/value-objects/ValueObjectInitialContext.js';
import { ValueObjectIsActive } from '../../../../src/ws-rest-flows/domain/value-objects/ValueObjectIsActive.js';
import { ValueObjectIsPrimary } from '../../../../src/ws-rest-flows/domain/value-objects/ValueObjectIsPrimary.js';
import { ValueObjectJsonDiagramProperties } from '../../../../src/ws-rest-flows/domain/value-objects/ValueObjectJsonDiagramProperties.js';
import { InvalidArgumentError } from '../../../../src/shared/index.js';

describe('WSRestFlow Value Objects', () => {
    describe('ValueObjectDescription', () => {
        it('stores value with field name "description"', () => {
            const vo = new ValueObjectDescription('a description');
            expect(vo.field).toBe('description');
            expect(vo.value).toBe('a description');
        });

        it('rejects non-string value (delegates to base)', () => {
            expect(() => new ValueObjectDescription(123)).toThrow(InvalidArgumentError);
        });
    });

    describe('ValueObjectExternalCode', () => {
        it('stores value with field name "external_code"', () => {
            const vo = new ValueObjectExternalCode('CODE_ABC');
            expect(vo.field).toBe('external_code');
            expect(vo.value).toBe('CODE_ABC');
        });

        it('rejects non-string value (delegates to base)', () => {
            expect(() => new ValueObjectExternalCode({ foo: 'bar' })).toThrow(InvalidArgumentError);
        });
    });

    describe('ValueObjectInitialContext', () => {
        it('stores value with field name "initial_context"', () => {
            const vo = new ValueObjectInitialContext({ key: 'value' });
            expect(vo.field).toBe('initial_context');
            expect(vo.value).toEqual({ key: 'value' });
        });

        it('accepts null because nullable=true is passed to the base', () => {
            const vo = new ValueObjectInitialContext(null);
            expect(vo.value).toBeNull();
        });
    });

    describe('ValueObjectIsActive', () => {
        it('stores value with field name "is_active"', () => {
            const vo = new ValueObjectIsActive(true);
            expect(vo.field).toBe('is_active');
            expect(vo.value).toBe(true);
        });

        it('rejects non-boolean value (delegates to base)', () => {
            expect(() => new ValueObjectIsActive('yes')).toThrow(InvalidArgumentError);
        });
    });

    describe('ValueObjectIsPrimary', () => {
        it('stores value with field name "is_primary"', () => {
            const vo = new ValueObjectIsPrimary(false);
            expect(vo.field).toBe('is_primary');
            expect(vo.value).toBe(false);
        });

        it('defaults to true when no value is passed', () => {
            const vo = new ValueObjectIsPrimary();
            expect(vo.value).toBe(true);
        });
    });

    describe('ValueObjectJsonDiagramProperties', () => {
        it('accepts valid diagram with nodes and edges', () => {
            const value = {
                nodes: [{ id: 'n1', data: { label: 'one' } }],
                edges: [{ id: 'e1', source: 'n1', target: 'n1' }],
            };
            const vo = new ValueObjectJsonDiagramProperties(value);
            expect(vo.field).toBe('json_diagram_properties');
            expect(vo.value).toEqual(value);
        });

        it('accepts diagram with nodes but without edges (edges is optional)', () => {
            const value = { nodes: [{ id: 'n1', data: { label: 'one' } }] };
            expect(() => new ValueObjectJsonDiagramProperties(value)).not.toThrow();
        });

        it('throws InvalidArgumentError when nodes is not an array', () => {
            expect(() => new ValueObjectJsonDiagramProperties({ nodes: 'not-an-array' })).toThrow(InvalidArgumentError);
        });

        it('throws InvalidArgumentError when nodes has fewer than MINIMUM_NODES (empty array)', () => {
            expect(() => new ValueObjectJsonDiagramProperties({ nodes: [] })).toThrow(InvalidArgumentError);
        });

        it('throws InvalidArgumentError when edges exists but is not an array', () => {
            const value = {
                nodes: [{ id: 'n1', data: { label: 'one' } }],
                edges: 'not-an-array',
            };
            expect(() => new ValueObjectJsonDiagramProperties(value)).toThrow(InvalidArgumentError);
        });

        it('exposes MINIMUM_NODES static property equal to 1', () => {
            expect(ValueObjectJsonDiagramProperties.MINIMUM_NODES).toBe(1);
        });
    });
});
