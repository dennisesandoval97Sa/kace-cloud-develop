import {
    Literal,
    LiteralCollectionResponse,
    LiteralResponse,
    ValueObjectLiteralName,
    LiteralSelectCollectionResponse,
} from '../../src/literals';
import { v4 as uuidV4 } from 'uuid';
import {
    DeleteFieldsDoNotExistError,
    ValueObjectBoolean,
    ValueObjectTimestamp,
    ValueObjectUuid,
} from '../../src/shared/index.js';
import LiteralMother from './domain/LiteralMother';

describe('Literal Entity', () => {
    const dto = LiteralMother.dto();

    it('should create a literal with valid data', () => {
        const literal = Literal.create(dto);
        expect(literal.id).toBeInstanceOf(ValueObjectUuid);
        expect(literal.tipo_literal).toBeInstanceOf(ValueObjectUuid);
        expect(literal.nombre).toBeInstanceOf(ValueObjectLiteralName);
        expect(literal.is_active).toBeInstanceOf(ValueObjectBoolean);
        expect(literal.created_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(literal.created_by).toBeInstanceOf(ValueObjectUuid);
    });

    it('should update literal data', () => {
        const literal = Literal.create(dto);
        const newNombre = 'Updated Name';
        const newData = {
            nombre: newNombre,
            tipo_literal: uuidV4(),
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };
        literal.update(newData);

        expect(literal.nombre.value).toBe(newNombre);
        expect(literal.tipo_literal.value).toBe(newData.tipo_literal);
        expect(literal.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => Literal.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const literal = Literal.create(dto);
        const unchangedData = {
            nombre: dto.nombre,
            tipo_literal: dto.tipo_literal,
            is_active: dto.is_active,
        };
        literal.update(unchangedData);

        expect(literal.changedAttributes).toEqual({});
    });

    it('marks a Literal instance as deleted', () => {
        const literal = Literal.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };
        literal.delete(deleteDto);

        expect(literal.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(literal.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const literal = Literal.create(dto);
        const deleteDto = {};

        expect(() => literal.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Literal instance', () => {
        const literal = Literal.create(dto);
        const updateDto = {
            nombre: 'Updated Name',
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };
        literal.update(updateDto);
        literal.flushChanges();

        expect(literal.changedAttributes).toEqual({});
    });
});

describe('LiteralResponse Tests', () => {
    it('converts Literal object to JSON representation', () => {
        const literal = Literal.create(LiteralMother.dto());
        const literalResponse = new LiteralResponse(literal);

        const json = literalResponse.toJson();

        expect(json).toEqual({
            data: {
                id: literal.id.value,
                tipo_literal: literal.tipo_literal.value,
                nombre: literal.nombre.value,
                is_active: literal.is_active.value,
                created_at: literal.created_at.value,
                updated_at: literal.updated_at.value,
                created_by: literal.created_by.value,
                updated_by: literal.updated_by.value,
            },
        });
    });

    it('returns an empty object if literal is not provided', () => {
        const literalResponse = new LiteralResponse(null);
        const json = literalResponse.toJson();

        expect(json).toEqual({});
    });

    it('converts LiteralCollection to JSON representation', () => {
        const literalCollection = [Literal.create(LiteralMother.dto()), Literal.create(LiteralMother.dto())];
        const literalCollectionResponse = new LiteralCollectionResponse(literalCollection, literalCollection.length);

        const json = literalCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: literalCollection.map((literal) => new LiteralResponse(literal).toJson().data),
            },
            metadata: {
                count: literalCollection.length,
            },
        });
    });
});

describe('ValueObjectLiteralName Tests', () => {
    it('should create a ValueObjectLiteralName with valid value', () => {
        const valueObject = new ValueObjectLiteralName('Valid Literal Name');
        expect(valueObject).toBeInstanceOf(ValueObjectLiteralName);
        expect(valueObject.value).toBe('Valid Literal Name');
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectLiteralName(value)).toThrow('The value cannot be null');
        });
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectLiteralName(null, true)).not.toThrow();
    });

    it('should throw an error when value exceeds maximum length', () => {
        const longValue = 'A'.repeat(256);
        expect(() => new ValueObjectLiteralName(longValue)).toThrow(
            'literal_name: The value must be at most 255 characters long'
        );
    });

    it('should throw an error when value is not a string', () => {
        expect(() => new ValueObjectLiteralName(123)).toThrow('literal_name: The value must be a string');
    });
});

describe('LiteralSelectCollectionResponse', () => {
    it('should map a Literal collection to { value, label } items and include count', () => {
        const lit1 = Literal.create(LiteralMother.dto({ nombre: 'Alpha' }));
        const lit2 = Literal.create(LiteralMother.dto({ nombre: 'Beta' }));

        const collection = [lit1, lit2];
        const response = new LiteralSelectCollectionResponse(collection, collection.length);

        const json = response.toJson();

        expect(json).toEqual({
            data: {
                items: [
                    { value: lit1.id.value, label: lit1.nombre.value },
                    { value: lit2.id.value, label: lit2.nombre.value },
                ],
            },
            metadata: { count: 2 },
        });
    });

    it('should return an empty items array with count=0 when collection is empty', () => {
        const response = new LiteralSelectCollectionResponse([], 0);
        const json = response.toJson();

        expect(json).toEqual({
            data: { items: [] },
            metadata: { count: 0 },
        });
    });

    it('should only expose value and label keys per item (no extra fields leaked)', () => {
        const lit = Literal.create(LiteralMother.dto({ nombre: 'OnlyKeys' }));
        const json = new LiteralSelectCollectionResponse([lit], 1).toJson();

        expect(Array.isArray(json.data.items)).toBe(true);
        expect(json.data.items.length).toBe(1);

        const item = json.data.items[0];
        const keys = Object.keys(item);
        expect(keys.sort()).toEqual(['label', 'value']);
    });

    it('should reflect the exact count passed (even if it differs from items length)', () => {
        const lit = Literal.create(LiteralMother.dto({ nombre: 'Paged' }));
        const response = new LiteralSelectCollectionResponse([lit], 42);
        const json = response.toJson();

        expect(json.metadata.count).toBe(42);
        expect(json.data.items).toEqual([{ value: lit.id.value, label: lit.nombre.value }]);
    });
});
