import { Ans, AnsCollectionResponse, AnsResponse, TypeLister, Types, ValueObjectTypes } from '../../src/ans/index.js';
import AnsMother from './domain/AnsMother.js';
import { v4 as uuidv4 } from 'uuid';
import { DeleteFieldsDoNotExistError } from '../../src/shared/errors/DeleteFieldsDoNotExistError.js';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import {
    DEFAULT_ANS_VISUAL_COLORS,
    SHARED_VISUAL_COLOR_ALLOWLIST,
} from '../../src/shared/visual-options/sharedVisualOptions.js';

describe('Ans Tests', () => {
    it('creates a new Ans instance from DTO', () => {
        const dto = AnsMother.dto();
        dto.updated_at = null;
        dto.updated_by = null;
        dto.deleted_at = null;
        dto.deleted_by = null;
        const ans = Ans.create(dto);

        expect(ans.id.value).toBe(dto.id);
        expect(ans.nombre.value).toBe(dto.nombre);
        expect(ans.intermedio.value).toBe(dto.intermedio);
        expect(ans.vencido.value).toBe(dto.vencido);
        expect(ans.color_ans_inicial.value).toBe(dto.color_ans_inicial);
        expect(ans.color_ans_intermedio.value).toBe(dto.color_ans_intermedio);
        expect(ans.color_ans_final.value).toBe(dto.color_ans_final);
        expect(ans.medicion_ans_id.value).toBe(dto.medicion_ans_id);
        expect(ans.status.value).toBe(dto.status);
        expect(ans.created_at.value).toBe(dto.created_at);
        expect(ans.updated_at.value).toBe(dto.updated_at);
        expect(ans.created_by.value).toBe(dto.created_by);
        expect(ans.updated_by.value).toBe(dto.updated_by);
        expect(ans.deleted_at.value).toBe(dto.deleted_at);
        expect(ans.deleted_by.value).toBe(dto.deleted_by);
    });

    it('updates an Ans instance with new values', () => {
        const dto = AnsMother.dto();
        const ans = Ans.create(dto);
        const updateDto = {
            nombre: 'Updated Name',
            intermedio: 15,
            vencido: 25,
            color_ans_inicial: SHARED_VISUAL_COLOR_ALLOWLIST[0],
            color_ans_intermedio: SHARED_VISUAL_COLOR_ALLOWLIST[1],
            color_ans_final: SHARED_VISUAL_COLOR_ALLOWLIST[2],
            medicion_ans_id: Types.HOURS.value,
            status: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        ans.update(updateDto);

        expect(ans.nombre.value).toBe(updateDto.nombre);
        expect(ans.intermedio.value).toBe(updateDto.intermedio);
        expect(ans.vencido.value).toBe(updateDto.vencido);
        expect(ans.color_ans_inicial.value).toBe(updateDto.color_ans_inicial);
        expect(ans.color_ans_intermedio.value).toBe(updateDto.color_ans_intermedio);
        expect(ans.color_ans_final.value).toBe(updateDto.color_ans_final);
        expect(ans.medicion_ans_id.value).toBe(updateDto.medicion_ans_id);
        expect(ans.status.value).toBe(updateDto.status);
        expect(ans.updated_at.value).toBe(updateDto.updated_at);
        expect(ans.updated_by.value).toBe(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = AnsMother.dto();
        const ans = Ans.create(dto);

        ans.update(dto);

        expect(ans.changedAttributes).toEqual({});
    });

    it('marks an Ans instance as deleted', () => {
        const dto = AnsMother.dto();
        const ans = Ans.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        ans.delete(deleteDto);

        expect(ans.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(ans.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('should throw a error if deleted fields are empty', () => {
        const dto = AnsMother.dto();
        const ans = Ans.create(dto);
        const deleteDto = {};

        expect(() => ans.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Ans instance', () => {
        const dto = AnsMother.dto();
        const ans = Ans.create(dto);
        const updateDto = {
            nombre: 'Updated Name',
            intermedio: 15,
            vencido: 25,
            color_ans_inicial: SHARED_VISUAL_COLOR_ALLOWLIST[0],
            color_ans_intermedio: SHARED_VISUAL_COLOR_ALLOWLIST[1],
            color_ans_final: SHARED_VISUAL_COLOR_ALLOWLIST[2],
            medicion_ans_id: Types.HOURS.value,
            status: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        ans.update(updateDto);
        ans.flushChanges();

        expect(ans.changedAttributes).toEqual({});
    });
});

describe('Types Tests', () => {
    let typeLister;

    beforeEach(() => {
        typeLister = new TypeLister();
    });

    it('returns an array of types', () => {
        const result = typeLister.execute();
        expect(result).toEqual([Types.DAYS, Types.HOURS, Types.MINUTES]);
    });
    it('returns an array with the correct length', () => {
        const result = typeLister.execute();
        expect(result.length).toBe(3);
    });

    it('returns an array containing DAYS type', () => {
        const result = typeLister.execute();
        expect(result).toContain(Types.DAYS);
    });

    it('returns an array containing HOURS type', () => {
        const result = typeLister.execute();
        expect(result).toContain(Types.HOURS);
    });

    it('returns an array containing MINUTES type', () => {
        const result = typeLister.execute();
        expect(result).toContain(Types.MINUTES);
    });

    it('return a minutes Type', () => {
        const result = Types.fromValue('Minutes');
        expect(result).toEqual(Types.MINUTES);
    });

    it('return a days Type', () => {
        const result = Types.fromValue('Days');
        expect(result).toEqual(Types.DAYS);
    });

    it('return a hours Type', () => {
        const result = Types.fromValue('Hours');
        expect(result).toEqual(Types.HOURS);
    });

    it('throws error when value is null', () => {
        expect(() => {
            new Types('TEST', null);
        }).toThrow('The value cannot be null');
    });

    it('throws error when value is invalid', () => {
        expect(() => {
            new Types('TEST', 'InvalidValue');
        }).toThrow('The value must be a valid Medition');
    });
});

describe('ValueObjectTypes Tests', () => {
    it('should create an instance with a valid value', () => {
        const value = Types.DAYS.value;
        const valueObject = new ValueObjectTypes('types', value);
        expect(valueObject).toBeInstanceOf(ValueObjectTypes);
    });

    it('should throw an error if the value is null', () => {
        const value = null;
        expect(() => new ValueObjectTypes('types', value)).toThrowError('Invalid value');
    });

    it('should throw an error if the value is undefined', () => {
        const value = undefined;
        expect(() => new ValueObjectTypes('types', value)).toThrowError('Invalid value');
    });

    it('should handle empty string as incorrect value', () => {
        const value = '';
        expect(() => new ValueObjectTypes('types', value)).toThrowError('Invalid value');
    });

    it('should reject an unknown type with a 400 InvalidArgumentError', () => {
        expect(() => new ValueObjectTypes('medicion_ans_id', 'Weeks')).toThrow(InvalidArgumentError);
        expect(() => new ValueObjectTypes('medicion_ans_id', 'Weeks')).toThrow(
            expect.objectContaining({ statusCode: 400 })
        );
    });
});

describe('Ans Responses Tests', () => {
    it('uses allowlisted ANS defaults when colors are omitted during create', () => {
        const ans = Ans.create({
            id: uuidv4(),
            nombre: 'Ans default',
            intermedio: 1,
            vencido: 2,
            medicion_ans_id: Types.DAYS.value,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });

        expect(ans.color_ans_inicial.value).toBe(DEFAULT_ANS_VISUAL_COLORS.initial);
        expect(ans.color_ans_intermedio.value).toBe(DEFAULT_ANS_VISUAL_COLORS.intermediate);
        expect(ans.color_ans_final.value).toBe(DEFAULT_ANS_VISUAL_COLORS.final);
    });

    it('converts Ans object to JSON representation', () => {
        const ans = new Ans(AnsMother.randomDto());
        const ansResponse = new AnsResponse(ans);

        const json = ansResponse.toJson();

        expect(json).toEqual({
            data: {
                id: ans.id.value,
                nombre: ans.nombre.value,
                intermedio: ans.intermedio.value,
                vencido: ans.vencido.value,
                color_ans_inicial: ans.color_ans_inicial.value,
                color_ans_intermedio: ans.color_ans_intermedio.value,
                color_ans_final: ans.color_ans_final.value,
                status: ans.status.value,
                medicion_ans_id: ans.medicion_ans_id.value,
                created_at: ans.created_at.value,
                updated_at: ans.updated_at.value,
                created_by: ans.created_by.value,
                updated_by: ans.updated_by.value,
            },
        });
    });

    it('converts AnsCollection to JSON representation', () => {
        const ansCollection = [new Ans(AnsMother.randomDto()), new Ans(AnsMother.randomDto())];
        const ansCollectionResponse = new AnsCollectionResponse(ansCollection, ansCollection.length);

        const json = ansCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: ansCollection.map((ans) => new AnsResponse(ans).toJson().data),
            },
            metadata: {
                count: ansCollection.length,
            },
        });
    });
});
