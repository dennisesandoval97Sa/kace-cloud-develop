import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc.js';
import dayjsTimezone from 'dayjs/plugin/timezone.js';
import WSRestFunctionMother from './domain/WSRestFunctionMother.js';
import { WSRestFunction } from '../../src/ws_rest_functions/domain/WSRestFunction.js';
import { WSRestFunctionResponse } from '../../src/ws_rest_functions/application/WSRestFunctionResponse.js';
import { WSRestFunctionCollectionResponse } from '../../src/ws_rest_functions/application/WSRestFunctionCollectionResponse.js';
import { InvalidArgumentError } from '../../src/shared/index.js';
import { ValueObjectStaticValue } from '../../src/ws_rest_functions/domain/value-objects/ValueObjectStaticValue.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);

const tenant = await new LocalTenantRepository().find();

describe('WSRestFunction Entity', () => {
    const dto = WSRestFunctionMother.dto();

    it('should create a WSRestFunction with valid data', async () => {
        await TenantContext.run(tenant, () => {
            const wsFunctions = WSRestFunction.create(dto);

            expect(wsFunctions.id.value).toBe(dto.id);
            expect(wsFunctions.description.value).toBe(dto.description);
            expect(wsFunctions.type.value).toBe(dto.type);
            expect(wsFunctions.filter_input.value).toBe(dto.filter_input);
            expect(wsFunctions.context_position.value).toBe(dto.context_position);
            expect(wsFunctions.value_static.value).toBe(dto.value_static);
            expect(wsFunctions.value_dynamic.value).toBe(dto.value_dynamic);
            expect(wsFunctions.is_active.value).toBe(dto.is_active);
            expect(wsFunctions.created_by.value).toBe(dto.created_by);
            expect(wsFunctions.created_at.value).toBe(dto.created_at);
            expect(wsFunctions.updated_at.value).toBe(dto.updated_at);
            expect(wsFunctions.updated_by.value).toBe(dto.updated_by);
        });
    });

    it('does not update properties when values are the same', async () => {
        await TenantContext.run(tenant, () => {
            const wsFunctions = WSRestFunction.create(dto);
            const sameData = { ...dto };
            wsFunctions.update(sameData);
            expect(wsFunctions.changedAttributes).toEqual({});
        });
    });

    it('flushes changes in WSRestFlow instance', async () => {
        await TenantContext.run(tenant, () => {
            const wsFunctions = WSRestFunction.create(dto);
            const updateDto = {
                description: 'Updated Flow Description',
                is_active: false,
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            };
            wsFunctions.update(updateDto);
            wsFunctions.flushChanges();
            expect(wsFunctions.changedAttributes).toEqual({});
        });
    });

    it('should update WSRestFunction data', async () => {
        await TenantContext.run(tenant, () => {
            const wsFunction = WSRestFunction.create(dto);
            const newData = {
                description: 'Updated Flow Description',
                is_active: false,
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            };
            wsFunction.update(newData);

            expect(wsFunction.description.value).toBe(newData.description);
            expect(wsFunction.is_active.value).toBe(newData.is_active);
            expect(wsFunction.updated_at.value).toBe(newData.updated_at);
            expect(wsFunction.updated_by.value).toBe(newData.updated_by);
        });
    });

    it('should throw an error with invalid UUID', async () => {
        await TenantContext.run(tenant, () => {
            const invalidData = { ...dto, id: 'invalid-uuid' };

            expect(() => WSRestFunction.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
        });
    });

    it('does not update properties when values are the same', async () => {
        await TenantContext.run(tenant, () => {
            const wsFunction = WSRestFunction.create(dto);
            const sameData = { ...dto };

            wsFunction.update(sameData);

            expect(wsFunction.changedAttributes).toEqual({});
        });
    });

    it('marks a WSRestFlow instance as deleted', async () => {
        await TenantContext.run(tenant, () => {
            const wsFunction = WSRestFunction.create(dto);
            const deleteDto = {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            };
            wsFunction.delete(deleteDto);

            expect(wsFunction.deleted_at.value).toBe(deleteDto.deleted_at);
            expect(wsFunction.deleted_by.value).toBe(deleteDto.deleted_by);
        });
    });

    it('keeps unmarked deleted fields as null', async () => {
        await TenantContext.run(tenant, () => {
            const wsFunction = WSRestFunction.create(dto);
            wsFunction.deleted_at = null;
            wsFunction.deleted_by = undefined;

            expect(wsFunction.deleted_at.value).toBeNull();
            expect(wsFunction.deleted_by.value).toBeUndefined();
        });
    });

    it('flushes changes in WSRestFlow instance', async () => {
        await TenantContext.run(tenant, () => {
            const wsFunction = WSRestFunction.create(dto);
            const updateDto = {
                description: 'Updated Flow Description',
                is_active: false,
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            };
            wsFunction.update(updateDto);
            wsFunction.flushChanges();

            expect(wsFunction.changedAttributes).toEqual({});
        });
    });

    it('should preserve null value for value_static', async () => {
        await TenantContext.run(tenant, () => {
            const data = { ...dto, value_static: null };
            const wsFunction = WSRestFunction.create(data);
            expect(wsFunction.value_static.value).toBeNull();
        });
    });

    it('should throw an error if value_dynamic is true and value_static is null', async () => {
        await TenantContext.run(tenant, () => {
            const data = { ...dto, value_dynamic: true, value_static: null };

            expect(() => WSRestFunction.create(data)).toThrow('value_static cannot be null if value_dynamic is true');
        });
    });
    it('should throw if value_static is not a string for text-based types', async () => {
        await TenantContext.run(tenant, () => {
            const textTypes = ['maskText', 'concatenate'];

            textTypes.forEach((type) => {
                const data = {
                    ...dto,
                    type,
                    value_dynamic: true,
                    value_static: '',
                };

                expect(() => WSRestFunction.create(data)).toThrow(
                    `value_static must be a non-empty string for function type "${type}"`
                );
            });
        });
    });

    it('should throw if value_static is not a number for number-based types', async () => {
        await TenantContext.run(tenant, () => {
            const numberTypes = ['increment'];

            numberTypes.forEach((type) => {
                const data = {
                    ...dto,
                    type,
                    value_dynamic: false,
                    value_static: 'texto', // ← tipo incorrecto
                };

                expect(() => WSRestFunction.create(data)).toThrow(
                    `value_static must be a valid number for function type "${type}"`
                );
            });
        });
    });

    describe('normalizeChannelHubRule function', () => {
        const createNormalizer = () =>
            WSRestFunction.create({
                ...WSRestFunctionMother.dto(),
                type: 'normalizeChannelHubRule',
                filter_input: { filter_input: ['channel_hub_tag'] },
                context_position: 'channel_hub_tag_request',
                value_static: null,
                value_dynamic: false,
            });

        it('omits empty optional fields and keeps required fields', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = createNormalizer();

                const result = wsFunction.execute({
                    connectionId: 'connection-id',
                    ruleName: 'support',
                    subjectContains: ['billing'],
                    subjectEquals: [],
                    toContains: '',
                    toEquals: null,
                    bodyContains: undefined,
                    bodyEquals: ['urgent'],
                    actionRules: { classifyAs: 'support' },
                    webhooks: [{ url: 'https://example.com/hook' }],
                });

                expect(result).toEqual({
                    connectionId: 'connection-id',
                    ruleName: 'support',
                    subjectContains: ['billing'],
                    bodyEquals: ['urgent'],
                    actionRules: { classifyAs: 'support' },
                    webhooks: [{ url: 'https://example.com/hook' }],
                });
            });
        });

        it.each([
            ['subjectContains', 'subjectEquals'],
            ['toContains', 'toEquals'],
            ['bodyContains', 'bodyEquals'],
            ['ccContains', 'ccEquals'],
            ['fromContains', 'fromEquals'],
        ])('keeps %s and omits %s when both have content', async (containsField, equalsField) => {
            await TenantContext.run(tenant, () => {
                const wsFunction = createNormalizer();

                const result = wsFunction.execute({
                    connectionId: 'connection-id',
                    ruleName: 'support',
                    [containsField]: ['contains-value'],
                    [equalsField]: ['equals-value'],
                    actionRules: { classifyAs: 'support' },
                });

                expect(result).toMatchObject({
                    connectionId: 'connection-id',
                    ruleName: 'support',
                    [containsField]: ['contains-value'],
                    actionRules: { classifyAs: 'support' },
                });
                expect(result).not.toHaveProperty(equalsField);
            });
        });

        it.each([
            ['connectionId is missing', { ruleName: 'support', actionRules: { classifyAs: 'support' } }],
            [
                'connectionId is empty',
                { connectionId: '   ', ruleName: 'support', actionRules: { classifyAs: 'support' } },
            ],
            ['ruleName is missing', { connectionId: 'connection-id', actionRules: { classifyAs: 'support' } }],
            [
                'ruleName is empty',
                { connectionId: 'connection-id', ruleName: '   ', actionRules: { classifyAs: 'support' } },
            ],
            [
                'actionRules.classifyAs is missing',
                { connectionId: 'connection-id', ruleName: 'support', actionRules: {} },
            ],
            [
                'actionRules.classifyAs is empty',
                { connectionId: 'connection-id', ruleName: 'support', actionRules: { classifyAs: '   ' } },
            ],
        ])('throws when %s', async (_caseName, input) => {
            await TenantContext.run(tenant, () => {
                const wsFunction = createNormalizer();

                expect(() => wsFunction.execute(input)).toThrow(/normalizeChannelHubRule:/);
            });
        });

        it('throws when the input is not an object', async () => {
            await TenantContext.run(tenant, () => {
                const wsFunction = createNormalizer();

                expect(() => wsFunction.execute(null)).toThrow('normalizeChannelHubRule: rule must be an object');
                expect(() => wsFunction.execute([])).toThrow('normalizeChannelHubRule: rule must be an object');
            });
        });
    });

    /**
     * `currentDate` no devuelve "hoy en UTC" ni "hoy en la zona del proceso":
     * `WSRestFunction` formatea con la instancia que `DayjsFactory` congela al
     * cargar el modulo, y esa instancia queda fijada a `process.env.TIMEZONE`
     * (America/Bogota por defecto). Por eso las esperas se construyen en esa
     * misma zona en vez de con `toISOString()` (UTC) o con los getters locales
     * de `Date`.
     *
     * Con las esperas anteriores el resultado dependia de la hora del dia: con
     * TZ=America/Mexico_City la suite pasaba por la manana y se ponia roja a
     * partir de las 18:00 locales, que es cuando en Bogota pasan de las 19:00 y
     * UTC ya va un dia por delante. La variante de formato propio fallaba ademas
     * en cualquier zona que no coincidiese con Bogota (TZ=UTC, TZ=Pacific/Kiritimati).
     *
     * Se lee el reloj, no se congela: nada de `jest.useFakeTimers()`.
     */
    describe('currentDate function', () => {
        const FUNCTION_TIMEZONE = process.env.TIMEZONE ?? 'America/Bogota';

        it('should return current date in default YYYYMMDD format', async () => {
            await TenantContext.run(tenant, () => {
                const data = { ...dto, type: 'currentDate' };
                const wsFunction = WSRestFunction.create(data);
                const result = wsFunction.execute();
                const expected = dayjs().tz(FUNCTION_TIMEZONE).format('YYYYMMDD');
                expect(result).toBe(expected);
            });
        });

        it('should return current date in custom format', async () => {
            await TenantContext.run(tenant, () => {
                const data = { ...dto, type: 'currentDate' };
                const wsFunction = WSRestFunction.create(data);
                const format = 'DD-MM-YYYY';
                const result = wsFunction.execute(format);

                const expected = dayjs().tz(FUNCTION_TIMEZONE).format(format);

                expect(result).toBe(expected);
            });
        });
    });
});

describe('WSRestFunction Response Tests', () => {
    it('converts WSRestFunction object to JSON representation', async () => {
        await TenantContext.run(tenant, () => {
            const wsRestFunction = WSRestFunction.create(WSRestFunctionMother.dto());
            const wsRestFunctionResponse = new WSRestFunctionResponse(wsRestFunction);
            const json = wsRestFunctionResponse.toJson();

            expect(json).toEqual({
                data: {
                    id: wsRestFunction.id.value,
                    description: wsRestFunction.description.value,
                    type: wsRestFunction.type.value,
                    filter_input: wsRestFunction.filter_input.value,
                    context_position: wsRestFunction.context_position.value,
                    value_static: wsRestFunction.value_static.value,
                    value_dynamic: wsRestFunction.value_dynamic.value,
                    is_active: wsRestFunction.is_active.value,
                    created_by: wsRestFunction.created_by.value,
                    created_at: wsRestFunction.created_at.value,
                    updated_at: wsRestFunction.updated_at.value,
                    updated_by: wsRestFunction.updated_by.value,
                },
            });
        });
    });

    it('returns an empty object if WSRestFunction is not provided', () => {
        const wsRestFunctionResponse = new WSRestFunctionResponse(null);
        const json = wsRestFunctionResponse.toJson();
        expect(json).toEqual({});
    });
});

describe('WSRestFunction Collection Response Tests', () => {
    it('converts WSRestFunction collection to JSON representation', async () => {
        await TenantContext.run(tenant, () => {
            const wsRestFunctionCollection = [
                WSRestFunction.create(WSRestFunctionMother.dto()),
                WSRestFunction.create(WSRestFunctionMother.dto()),
            ];
            const wsRestFunctionCollectionResponse = new WSRestFunctionCollectionResponse(
                wsRestFunctionCollection,
                wsRestFunctionCollection.length
            );
            const json = wsRestFunctionCollectionResponse.toJson();

            expect(json).toEqual({
                data: {
                    items: wsRestFunctionCollection.map(
                        (wsRestFunction) => new WSRestFunctionResponse(wsRestFunction).toJson().data
                    ),
                },
                metadata: {
                    count: wsRestFunctionCollection.length,
                },
            });
        });
    });
});

describe('WSRestFunction Getters and Setters', () => {
    let wsFunction;
    let dto;

    beforeEach(async () => {
        dto = WSRestFunctionMother.dto();
        await TenantContext.run(tenant, () => {
            wsFunction = WSRestFunction.create(dto);
        });
    });

    it('should set and get description correctly', async () => {
        await TenantContext.run(tenant, () => {
            const newDescription = 'New Description';
            wsFunction.description = newDescription;
            expect(wsFunction.description.value).toBe(newDescription);
        });
    });

    it('should set and get type correctly', async () => {
        await TenantContext.run(tenant, () => {
            const newType = 'formatDate';
            wsFunction.type = newType;
            expect(wsFunction.type.value).toBe(newType);
        });
    });

    it('should throw an error when setting type to a non-string', async () => {
        await TenantContext.run(tenant, () => {
            expect(() => {
                wsFunction.type = 123;
            }).toThrow(InvalidArgumentError);
        });
    });

    it('should not change type if set to the same value', async () => {
        await TenantContext.run(tenant, () => {
            wsFunction.type = 'formatDate';
            wsFunction.type = 'formatDate';
            expect(wsFunction.changedAttributes.type).toBeUndefined();
        });
    });

    it('should set and get filter_input correctly', async () => {
        await TenantContext.run(tenant, () => {
            const newFilterInput = { filter_input: ['hola'] };
            wsFunction.filter_input = newFilterInput;
            expect(wsFunction.filter_input.value).toEqual(newFilterInput);
        });
    });

    describe('#context_position', () => {
        it('should set and get context_position correctly', async () => {
            await TenantContext.run(tenant, () => {
                const newContext = 'items[0].price';
                wsFunction.context_position = newContext;
                expect(wsFunction.context_position.value).toBe(newContext);
            });
        });

        it('should throw an error when setting context_position to a non-string', async () => {
            await TenantContext.run(tenant, () => {
                expect(() => {
                    wsFunction.context_position = 12345;
                }).toThrow(InvalidArgumentError);
            });
        });

        it('should throw an error when setting context_position to an empty string', async () => {
            await TenantContext.run(tenant, () => {
                expect(() => {
                    wsFunction.context_position = '';
                }).toThrow(Error);
            });
        });

        it('should not change context_position if set to the same value', async () => {
            await TenantContext.run(tenant, () => {
                const initialValue = 'items[0].price';
                wsFunction.context_position = initialValue;
                wsFunction.context_position = initialValue;
                expect(wsFunction.context_position.value).toBe(initialValue);
            });
        });

        it('should throw an error when setting context_position to null', async () => {
            await TenantContext.run(tenant, () => {
                expect(() => {
                    wsFunction.context_position = null;
                }).toThrow('The value cannot be null');
            });
        });

        it('should throw an error when setting context_position to an invalid format', async () => {
            await TenantContext.run(tenant, () => {
                expect(() => {
                    wsFunction.context_position = 'invalid path';
                }).toThrow(Error);
            });
        });
    });

    it('should set and get value_static correctly', async () => {
        await TenantContext.run(tenant, () => {
            const newValueStatic = 'Test value_static';
            wsFunction.value_static = newValueStatic;
            expect(wsFunction.value_static.value).toBe(newValueStatic);
        });
    });

    it('should not change value_static if set to the same value', async () => {
        await TenantContext.run(tenant, () => {
            const initialValue = 'Initial value';
            wsFunction.value_static = initialValue;
            wsFunction.value_static = initialValue;
            expect(wsFunction.value_static.value).toBe(initialValue);
        });
    });

    it('should set and get value_dynamic correctly', async () => {
        await TenantContext.run(tenant, () => {
            const newValueDynamic = false;
            wsFunction.value_dynamic = newValueDynamic;
            expect(wsFunction.value_dynamic.value).toEqual(newValueDynamic);
        });
    });

    it('should throw an error when setting value_dynamic to a non-boolean', async () => {
        await TenantContext.run(tenant, () => {
            expect(() => {
                wsFunction.value_dynamic = 'not a boolean';
            }).toThrow(InvalidArgumentError);
        });
    });

    it('should throw an error when setting value_dynamic to null', async () => {
        await TenantContext.run(tenant, () => {
            expect(() => {
                wsFunction.value_dynamic = null;
            }).toThrow(Error);
        });
    });

    it('should not change value_dynamic if set to the same value', async () => {
        await TenantContext.run(tenant, () => {
            const initialValue = true;
            wsFunction.value_dynamic = initialValue;
            wsFunction.value_dynamic = initialValue;
            expect(wsFunction.value_dynamic.value).toEqual(initialValue);
        });
    });

    it('should set and get is_active correctly', async () => {
        await TenantContext.run(tenant, () => {
            wsFunction.is_active = false;
            expect(wsFunction.is_active.value).toBe(false);
        });
    });
});

describe('ValueObjectStaticValue', () => {
    it('should throw an error if value is not string, number, or null', () => {
        expect(() => new ValueObjectStaticValue({})).toThrow(InvalidArgumentError);
        expect(() => new ValueObjectStaticValue([])).toThrow(InvalidArgumentError);
        expect(() => new ValueObjectStaticValue(true)).toThrow(InvalidArgumentError);
    });
});
