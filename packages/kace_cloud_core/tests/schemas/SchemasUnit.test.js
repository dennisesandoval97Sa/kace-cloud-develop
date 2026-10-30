import { VODataStructure } from '../../src/schemas/domain/VODataStructure.js';
import { SchemasMother } from './domain/SchemasMother.js';
import { ValidationFailError, TenantContext } from '../../src/shared/index.js';
import { SchemaCollectionResponse } from '../../src/schemas/application/SchemaCollectionResponse.js';
import { SchemaResponse } from '../../src/schemas/application/SchemaResponse.js';
import { v4 as uuidv4 } from 'uuid';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';

describe('VODataStructure - unit tests', () => {
    let tenant;
    beforeAll(async () => {
        tenant = await new LocalTenantRepository().find();
    });

    it('should accept a valid number structure', () => {
        expect(() => new VODataStructure(SchemasMother.validNumberStructure())).not.toThrow();
    });

    it('should accept a valid date structure', () => {
        expect(() => new VODataStructure(SchemasMother.validDateStructure())).not.toThrow();
    });

    it('should fail when the structure is empty', () => {
        // Guarantees AuxDefinitionDataStructureFinder (packages/kace_cloud_core/src/aux_definitions/application/find)
        // never has to defend against a constructed Schema with an empty/missing data_structure.
        expect(() => new VODataStructure({})).toThrow(ValidationFailError);
        expect(() => new VODataStructure({})).toThrow(/data_structure cannot be empty/);
    });

    it('should fail when the structure is undefined', () => {
        expect(() => new VODataStructure(undefined)).toThrow();
    });

    it('should fail when type is missing in field definition', () => {
        const structure = { campo: { required: true } };
        expect(() => new VODataStructure(structure)).toThrow(ValidationFailError);
    });

    it('should fail when required is missing in field definition', () => {
        expect(() => new VODataStructure(SchemasMother.missingRequiredProperty())).toThrow(ValidationFailError);
        expect(() => new VODataStructure(SchemasMother.missingRequiredProperty())).toThrow(
            /must include a 'required' property/
        );
    });

    it('should fail when an unsupported type is provided', () => {
        const structure = { campo: { type: 'unsupported', required: true } };
        expect(() => new VODataStructure(structure)).toThrow(ValidationFailError);
        expect(() => new VODataStructure(structure)).toThrow(/has unsupported type/);
    });

    it('should fail when required is not a boolean', () => {
        const structure = { campo: { type: 'string', required: 'yes' } };
        expect(() => new VODataStructure(structure)).toThrow(ValidationFailError);
        expect(() => new VODataStructure(structure)).toThrow(/must be a boolean/);
    });

    it('should accept unique: true on a scalar string field', () => {
        const structure = { campo: { type: 'string', required: false, unique: true } };
        expect(() => new VODataStructure(structure)).not.toThrow();
    });

    it('should accept unique: true on a scalar number field', () => {
        const structure = { campo: { type: 'number', required: false, unique: true } };
        expect(() => new VODataStructure(structure)).not.toThrow();
    });

    it('should accept unique: true on a scalar boolean field', () => {
        const structure = { campo: { type: 'boolean', required: false, unique: true } };
        expect(() => new VODataStructure(structure)).not.toThrow();
    });

    it('should accept unique: true on a scalar date field', () => {
        const structure = { campo: { type: 'date', required: false, unique: true, timezoneFormat: 'withTimezone' } };
        expect(() => new VODataStructure(structure)).not.toThrow();
    });

    it('should accept unique: false on any field', () => {
        const structure = { campo: { type: 'number', required: false, unique: false } };
        expect(() => new VODataStructure(structure)).not.toThrow();
    });

    it('should accept a field without the unique property (optional)', () => {
        const structure = { campo: { type: 'string', required: true } };
        expect(() => new VODataStructure(structure)).not.toThrow();
    });

    it('should fail when unique is not a boolean', () => {
        const structure = { campo: { type: 'string', required: false, unique: 'yes' } };
        expect(() => new VODataStructure(structure)).toThrow(ValidationFailError);
        expect(() => new VODataStructure(structure)).toThrow(/must be a boolean/);
    });

    it('should fail when unique: true is used with type array', () => {
        const structure = { campo: { type: 'array', required: false, unique: true, schema_id: 'some-id' } };
        expect(() => new VODataStructure(structure)).toThrow(ValidationFailError);
        expect(() => new VODataStructure(structure)).toThrow(/not supported for type/);
    });

    it('should fail when unique: true is used with type object', () => {
        const structure = { campo: { type: 'object', required: false, unique: true, schema_id: 'some-id' } };
        expect(() => new VODataStructure(structure)).toThrow(ValidationFailError);
        expect(() => new VODataStructure(structure)).toThrow(/not supported for type/);
    });

    it('should accept unique: true on a calculated field (composite unique scenario)', () => {
        const structure = {
            campo: {
                type: 'calculated',
                required: false,
                unique: true,
                calc: { formula: 'sum(1,2)', on: ['create'], error_policy: 'error' },
            },
        };
        expect(() => new VODataStructure(structure)).not.toThrow();
    });

    it('should accept a schema with unique: true on a calculated field combining two other fields', () => {
        const structure = {
            field_a: { type: 'number', required: true },
            field_b: { type: 'number', required: true },
            combined: {
                type: 'calculated',
                required: false,
                unique: true,
                calc: {
                    formula: 'sum(ref("field_a"), ref("field_b"))',
                    on: ['create', 'update'],
                    error_policy: 'error',
                },
            },
        };
        expect(() => new VODataStructure(structure)).not.toThrow();
    });

    it('should fail if number property has incorrect type', () => {
        expect(() => new VODataStructure(SchemasMother.invalidNumberPropertyType())).toThrow(ValidationFailError);
        expect(() => new VODataStructure(SchemasMother.invalidNumberPropertyType())).toThrow(/must be a number/);
    });

    it('should fail if date property has incorrect type', async () => {
        await TenantContext.run(tenant, () => {
            expect(() => new VODataStructure(SchemasMother.invalidDatePropertyType())).toThrow(ValidationFailError);
            expect(() => new VODataStructure(SchemasMother.invalidDatePropertyType())).toThrow(/must be a boolean/);
        });
    });

    it('should accept valid string structure', () => {
        const value = {
            field: {
                type: 'string',
                required: true,
                empty: false,
                min: 3,
                max: 10,
                default: 'hello',
            },
        };
        expect(() => new VODataStructure(value)).not.toThrow();
    });

    it('should fail if default in string is not a string', () => {
        const value = {
            field: {
                type: 'string',
                required: true,
                default: false,
            },
        };
        expect(() => new VODataStructure(value)).toThrow(ValidationFailError);
        expect(() => new VODataStructure(value)).toThrow(/must be a string/);
    });

    it('should fail if string has unexpected key', () => {
        const value = {
            field: {
                type: 'string',
                required: true,
                unknown: true,
            },
        };
        expect(() => new VODataStructure(value)).toThrow(ValidationFailError);
        expect(() => new VODataStructure(value)).toThrow(/unsupported key/);
    });

    it('should accept valid boolean structure', () => {
        const value = {
            field: {
                type: 'boolean',
                required: true,
                truthyValues: ['yes'],
                falsyValues: ['no'],
                default: false,
            },
        };
        expect(() => new VODataStructure(value)).not.toThrow();
    });

    it('should fail if default in boolean is not a boolean', () => {
        const value = {
            field: {
                type: 'boolean',
                required: true,
                default: 'nope',
            },
        };
        expect(() => new VODataStructure(value)).toThrow(ValidationFailError);
        expect(() => new VODataStructure(value)).toThrow(/debe ser booleano/);
    });

    it('should fail if boolean contains unexpected key', () => {
        const value = {
            field: {
                type: 'boolean',
                required: true,
                trim: true,
            },
        };
        expect(() => new VODataStructure(value)).toThrow(ValidationFailError);
        expect(() => new VODataStructure(value)).toThrow(/unsupported key/);
    });

    it('throws an error if the structure is empty', () => {
        expect(() => new VODataStructure({})).toThrow(ValidationFailError);
    });

    it('converts a collection of Schemas to JSON with metadata', async () => {
        const items = [await SchemasMother.create(), await SchemasMother.create()];
        const count = items.length;
        const response = new SchemaCollectionResponse(items, count);
        const json = response.toJson();
        expect(json).toHaveProperty('data');
        expect(json.data).toHaveProperty('items');
        expect(Array.isArray(json.data.items)).toBe(true);
        expect(json.data.items.length).toBe(count);
        expect(json).toHaveProperty('metadata');
        expect(json.metadata.count).toBe(count);
    });

    it('handles an empty collection correctly', () => {
        const response = new SchemaCollectionResponse([], 0);
        const json = response.toJson();
        expect(json.data.items).toEqual([]);
        expect(json.metadata.count).toBe(0);
    });

    it('converts a valid Schema to JSON', async () => {
        const dto = SchemasMother.dto();
        const schema = await SchemasMother.create(dto);
        const response = new SchemaResponse(schema);
        const json = response.toJson();
        expect(json).toHaveProperty('data');
        expect(json.data).toMatchObject({
            id: dto.id,
            name: dto.name,
            is_active: dto.is_active,
            data_structure: dto.data_structure,
            created_at: dto.created_at,
            created_by: dto.created_by,
            updated_at: dto.updated_at,
            updated_by: dto.updated_by,
            deleted_at: dto.deleted_at,
            deleted_by: dto.deleted_by,
        });
    });

    it('returns an empty object if the Schema is null', () => {
        const response = new SchemaResponse(null);
        expect(response.toJson()).toEqual({});
    });

    // El SQLInjectionGuard solo bloquea en modo enforce, y la corrida hereda
    // SQL_GUARD_MODE=observe del .env de la raiz que carga jest.config.js. Este
    // test describe el modo enforce, asi que lo fija el mismo en vez de depender
    // del entorno ambiente. El XSSGuard no tiene modo observe y no lo necesita.
    const withSqlGuardEnforced = (assertion) => {
        const previous = process.env.SQL_GUARD_MODE;
        process.env.SQL_GUARD_MODE = 'enforce';

        try {
            assertion();
        } finally {
            if (previous === undefined) {
                delete process.env.SQL_GUARD_MODE;
            } else {
                process.env.SQL_GUARD_MODE = previous;
            }
        }
    };

    it('throws an error if a string field contains SQL injection keywords', () => {
        const value = {
            field: {
                type: 'string',
                required: true,
                default: 'into',
            },
        };
        withSqlGuardEnforced(() => {
            expect(() => new VODataStructure(value)).toThrow(/Palabras prohibidas detectadas/);
        });
    });

    it('throws an error if a string field contains XSS-related content', () => {
        const value = {
            field: {
                type: 'string',
                required: true,
                default: '<script>',
            },
        };
        expect(() => new VODataStructure(value)).toThrow(/Palabras prohibidas detectadas/);
    });

    it('should accept a valid object structure', () => {
        expect(() => new VODataStructure(SchemasMother.validObjectStructure())).not.toThrow();
    });

    it('should accept a valid object structure with keys like "form_OS-UUID', () => {
        expect(
            () =>
                new VODataStructure(
                    SchemasMother.validObjectStructure({
                        'form_OS-UUID': { type: 'object', required: true, schema_id: uuidv4() },
                    })
                )
        ).not.toThrow();
    });

    it('should accept a valid nested object structure', () => {
        expect(() => new VODataStructure(SchemasMother.validNestedObjectStructure())).not.toThrow();
    });

    it('should fail if a key in object is missing the type property', () => {
        expect(() => new VODataStructure(SchemasMother.invalidObjectMissingTypeInKey())).toThrow(ValidationFailError);
        expect(() => new VODataStructure(SchemasMother.invalidObjectMissingTypeInKey())).toThrow(
            /must include a 'type' property/
        );
    });

    it('should fail if a key in object has an unsupported type', () => {
        expect(() => new VODataStructure(SchemasMother.invalidObjectUnsupportedTypeInKey())).toThrow(
            ValidationFailError
        );
        expect(() => new VODataStructure(SchemasMother.invalidObjectUnsupportedTypeInKey())).toThrow(
            /has unsupported type/
        );
    });

    it('should accept a valid array structure', () => {
        expect(() => new VODataStructure(SchemasMother.validArrayStructure())).not.toThrow();
    });

    it('should fail if array is missing the type property', () => {
        expect(() => new VODataStructure(SchemasMother.invalidArrayMissingType())).toThrow(ValidationFailError);
        expect(() => new VODataStructure(SchemasMother.invalidArrayMissingType())).toThrow(
            /must include a 'type' property/
        );
    });

    it('should fail if array has an invalid schema_id', () => {
        expect(() => new VODataStructure(SchemasMother.invalidArrayInvalidSchemaId())).toThrow(
            /Invalid value not-a-uuid/
        );
    });

    it('should fail if array contains an unexpected key', () => {
        expect(() => new VODataStructure(SchemasMother.invalidArrayUnexpectedKey())).toThrow(ValidationFailError);
        expect(() => new VODataStructure(SchemasMother.invalidArrayUnexpectedKey())).toThrow(/unsupported key/);
    });

    it('should accept valid date structure with empty property', async () => {
        await TenantContext.run(tenant, () => {
            const value = {
                field: {
                    type: 'date',
                    required: true,
                    empty: false,
                },
            };
            expect(() => new VODataStructure(value)).not.toThrow();
        });
    });

    it('should accept a valid calculated field with correct formula and config', () => {
        const value = {
            total: {
                type: 'calculated',
                required: true,
                ui: { label: 'Total', input_type: 'number' },
                calc: {
                    formula: 'sum(1,2)',
                    on: ['create'],
                    error_policy: 'error',
                },
            },
        };
        expect(() => new VODataStructure(value)).not.toThrow();
    });

    it('should fail if formula contains invalid function', () => {
        const value = {
            suma_total: {
                type: 'calculated',
                required: true,
                ui: { label: 'Suma total', input_type: 'number' },
                calc: {
                    formula: 'invalid(1,2)',
                    on: ['create'],
                    error_policy: 'error',
                },
            },
        };
        expect(() => new VODataStructure(value)).toThrow(/Invalid function "invalid" in formula/);
    });

    it('should fail if input_type in ui is invalid', () => {
        const value = {
            suma_total: {
                type: 'calculated',
                required: true,
                ui: { input_type: 'slider' },
                calc: {
                    formula: 'sum(1,2)',
                    on: ['create'],
                    error_policy: 'error',
                },
            },
        };
        expect(() => new VODataStructure(value)).toThrow(/'suma_total.ui.input_type' tiene un valor inválido/);
    });

    it('should accept currency as valid input_type in ui', () => {
        const value = {
            amount: {
                type: 'number',
                required: true,
                ui: { label: 'Amount', input_type: 'currency' },
            },
        };
        expect(() => new VODataStructure(value)).not.toThrow();
    });

    it('should accept string field when ui is omitted', () => {
        const value = {
            field: {
                type: 'string',
                required: true,
                empty: false,
                min: 1,
                max: 10,
                default: 'a',
            },
        };
        expect(() => new VODataStructure(value)).not.toThrow();
    });

    it('should accept empty ui object on string field', () => {
        const value = {
            field: {
                type: 'string',
                required: true,
                empty: false,
                min: 1,
                max: 10,
                default: 'a',
                ui: {},
            },
        };
        expect(() => new VODataStructure(value)).not.toThrow();
    });

    it('should accept partial ui with only optional keys present', () => {
        const value = {
            field: {
                type: 'string',
                required: true,
                empty: false,
                min: 1,
                max: 10,
                default: 'a',
                ui: { label: 'Solo etiqueta' },
            },
        };
        expect(() => new VODataStructure(value)).not.toThrow();
    });

    it('should fail when ui contains unknown key', () => {
        const value = {
            field: {
                type: 'string',
                required: true,
                empty: false,
                min: 1,
                max: 10,
                default: 'a',
                ui: { extraUiKey: true },
            },
        };
        expect(() => new VODataStructure(value)).toThrow(/'field.ui' contiene la clave no permitida 'extraUiKey'/);
    });

    it('should fail if error_policy is invalid', () => {
        const value = {
            suma_total: {
                type: 'calculated',
                required: true,
                ui: { input_type: 'number' },
                calc: {
                    formula: 'sum(1,2)',
                    on: ['create'],
                    error_policy: 'ignore',
                },
            },
        };
        expect(() => new VODataStructure(value)).toThrow(
            "'suma_total.calc.error_policy' must be one of: error, empty."
        );
    });

    // --- DateTypeValidator timezone tests ---

    describe('DateTypeValidator - timezone support', () => {
        it('should accept date with timezoneFormat=withTimezone', () => {
            expect(() => new VODataStructure(SchemasMother.dateWithTimezoneFormatWithTimezone())).not.toThrow();
        });

        it('should accept date with timezoneFormat=withoutTimezone and valid IANA timezone', () => {
            expect(() => new VODataStructure(SchemasMother.dateWithTimezoneFormatWithoutTimezone())).not.toThrow();
        });

        it('should accept date with timezoneFormat=withTimezone and timestamp=javascript', () => {
            expect(
                () => new VODataStructure(SchemasMother.dateWithTimezoneFormatWithTimezoneAndTimestamp())
            ).not.toThrow();
        });

        it('should accept date with timezoneFormat=withTimezone and timestamp=unix', () => {
            expect(
                () => new VODataStructure(SchemasMother.dateWithTimezoneFormatWithTimezoneAndUnixTimestamp())
            ).not.toThrow();
        });

        it('should accept date with timezoneFormat=withoutTimezone and timestamp (coexisten)', () => {
            expect(
                () => new VODataStructure(SchemasMother.dateWithTimezoneFormatWithoutTimezoneAndTimestamp())
            ).not.toThrow();
        });

        it('should reject date with invalid timezoneFormat value', () => {
            expect(() => new VODataStructure(SchemasMother.dateWithInvalidTimezoneFormat())).toThrow(
                /debe ser 'withTimezone' o 'withoutTimezone'/
            );
        });

        it('should reject date with invalid IANA timezone', () => {
            expect(() => new VODataStructure(SchemasMother.dateWithInvalidTimezone())).toThrow(
                /debe ser una zona horaria IANA válida/
            );
        });

        it('should reject date with non-string timezoneFormat', () => {
            expect(() => new VODataStructure(SchemasMother.dateWithNonStringTimezoneFormat())).toThrow(
                /timezoneFormat.*must be a string/
            );
        });

        it('should reject date with non-string timezone', () => {
            expect(() => new VODataStructure(SchemasMother.dateWithNonStringTimezone())).toThrow(
                /timezone.*must be a string/
            );
        });

        it('should accept date with all timezone constraints valid', () => {
            expect(() => new VODataStructure(SchemasMother.dateWithValidTimezoneAll())).not.toThrow();
        });

        it('should apply default timezoneFormat=withoutTimezone when not specified', async () => {
            await TenantContext.run(tenant, () => {
                const structure = {
                    field: {
                        type: 'date',
                        required: true,
                    },
                };
                expect(() => new VODataStructure(structure)).not.toThrow();
            });
        });

        it('should use tenant.timezone when timezoneFormat=withoutTimezone and timezone is null', async () => {
            await TenantContext.run(tenant, () => {
                const structure = {
                    field: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withoutTimezone',
                        timezone: null,
                    },
                };
                expect(() => new VODataStructure(structure)).not.toThrow();
            });
        });

        it('should throw error when timezoneFormat=withoutTimezone, timezone is null and no tenant timezone is available', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withoutTimezone',
                    timezone: null,
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/Variable de entorno TIMEZONE no está definida/);
        });

        it('should accept valid IANA timezones: UTC, America/Bogota, America/New_York', () => {
            const timezones = ['UTC', 'America/Bogota', 'America/New_York'];
            timezones.forEach((tz) => {
                const structure = {
                    field: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withoutTimezone',
                        timezone: tz,
                    },
                };
                expect(() => new VODataStructure(structure)).not.toThrow();
            });
        });
    });
});
