import { GlobalContext } from '../../../../src/shared/domain/global-context/GlobalContext.js';
import { GlobalContextProcessor } from '../../../../src/shared/domain/global-context/GlobalContextProcessor.js';
import { ValidationFailError } from '../../../../src/shared/errors/ValidationFailError.js';

describe('GlobalContextProcessor test', () => {
    let global;

    beforeEach(() => {
        global = new GlobalContext();
    });

    it('add data to global context', () => {
        const contextPositionOne = 'positionStepOne';
        const contextPositionTwo = 'positionStepTwo';

        const response1 = {
            data: {
                fecha: '2025/04/11',
                fecha2: '2025-04-12',
                precio: 1000000,
                producto: 'carro',
            },
            status: 200,
        };
        const response2 = {
            data: {
                fecha: '2025/04/01',
                precio: 500000,
                producto: 'casa',
            },
            status: 200,
        };

        global.addDataProcessedToGlobalContext(contextPositionOne, response1);
        global.addDataProcessedToGlobalContext(contextPositionTwo, response2);

        expect(global.get()).toStrictEqual({
            context: {
                positionStepOne: response1,
                positionStepTwo: response2,
            },
        });
    });

    it('should replace values in an object with context body', async () => {
        const expected = {
            body: {
                username: 'new_user',
                token: 'ejgvnda.new_token',
                active: 'step1.active',
                date: '2025/04/11',
                description: 'another text without context',
            },
        };
        global.addDataProcessedToGlobalContext('data', expected.body);

        const sendData = {
            body: {
                username: 'context.data.username',
                token: 'context.data.token',
                active: 'step1.active',
                date: 'context.data.date',
                description: 'another text without context',
            },
        };

        const globalReplace = new GlobalContextProcessor(global);

        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(expected);
    });

    it('should replace values in an object with context body with space + anything', async () => {
        const sendData = {
            body: {
                username: 'Bearer context.data.date',
                token: 'context.data.date Bearer',
                active: 'data.active',
                date: 'context.data.date',
                description: 'another text without context',
            },
        };

        const expected = {
            body: {
                username: 'Bearer 2025/04/11',
                token: '2025/04/11 Bearer',
                active: 'data.active',
                date: '2025/04/11',
                description: 'another text without context',
            },
        };
        global.addDataProcessedToGlobalContext('data', expected.body);
        const globalReplace = new GlobalContextProcessor(global);

        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(expected);
    });

    it('should replace values in an object with context header', async () => {
        const sendData = {
            headers: {
                username: 'context.data.username',
                token: 'context.data.token',
                active: 'data.active',
                date: 'context.date.fecha',
                description: 'another text without context',
            },
        };

        const result = {
            headers: {
                username: '2025/04/11',
                token: '2025-04-12',
                active: 'data.active',
                date: null,
                description: 'another text without context',
            },
        };
        global.addDataProcessedToGlobalContext('data', result.headers);
        const globalReplace = new GlobalContextProcessor(global);

        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(result);
    });

    it('should replace values in an object with context header with space + anything', async () => {
        const sendData = {
            headers: {
                username: 'Bearer context.step1.data.date',
                token: 'context.step1.data.token',
                active: 'step1.active',
                date: 'context.step1.data.date',
                description: 'another text without context',
            },
        };

        const result = {
            headers: {
                username: 'Bearer 2025/04/11',
                token: '2025-04-12 Bearer',
                active: 'step1.active',
                date: '2025/04/11',
                description: 'another text without context',
            },
        };

        global.addDataProcessedToGlobalContext('step1.data', result.headers);

        const globalReplace = new GlobalContextProcessor(global);

        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(result);
    });

    it('should throw ValidationFailError when an invalid key is used', async () => {
        const sendData = {
            invalidKey: 'context.step1.data.fecha',
        };

        const globalReplace = new GlobalContextProcessor(global);

        await expect(globalReplace.replace(sendData)).rejects.toThrowError(ValidationFailError);
    });

    it('should return the input unchanged if it is not a string or object', async () => {
        const sendData = 12345;

        const globalReplace = new GlobalContextProcessor(global);

        await expect(globalReplace.replace(sendData)).rejects.toThrowError(ValidationFailError);
    });
    it('should handle a string input and return transformed value', async () => {
        const sendData = 'context.step1.data.fecha';
        const result = '2025/04/11';

        global.addDataProcessedToGlobalContext('step1.data.fecha', result);
        const globalReplace = new GlobalContextProcessor(global);

        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(result);
    });

    it('should handle a string input and return transformed value with space + anything to start', async () => {
        const sendData = 'Bearer context.step1.data.fecha';
        const result = 'Bearer 2025/04/11';

        global.addDataProcessedToGlobalContext('step1.data.fecha', '2025/04/11');
        const globalReplace = new GlobalContextProcessor(global);

        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(result);
    });

    it('should handle a string input and return transformed value with space + anything to end', async () => {
        const sendData = 'context.step1.data.fecha Bearer';
        const result = '2025/04/11 Bearer';

        global.addDataProcessedToGlobalContext('step1.data.fecha', '2025/04/11');
        const globalReplace = new GlobalContextProcessor(global);

        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(result);
    });

    it('should throw ValidationFailError if input is not a string when replacing string value', async () => {
        const sendData = 12345;

        const globalReplace = new GlobalContextProcessor(global);

        await expect(globalReplace.replace(sendData)).rejects.toThrowError(ValidationFailError);
    });

    it('should throw error when accessing an unallowed key in the context', async () => {
        const sendData = {
            errorBody: {
                Authorization: 'context.step1.token',
            },
        };

        const globalReplace = new GlobalContextProcessor(global);

        await expect(globalReplace.replace(sendData)).rejects.toThrowError(ValidationFailError);
    });

    it('should handle empty context and return the same value', async () => {
        const sendData = {
            body: {
                username: 'no_context_here',
            },
        };

        const result = {
            body: { username: 'no_context_here' },
        };

        const globalReplace = new GlobalContextProcessor(global);

        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(result);
    });

    it('should add "case" data to global context', () => {
        const contextPosition = 'case';
        const data = {
            id: '7f2aa69f-e240-47f8-802e-00c443bcdaf5',
        };

        global.addDataProcessedToGlobalContext(contextPosition, data);

        expect(global.get()).toStrictEqual({
            context: {
                case: {
                    id: '7f2aa69f-e240-47f8-802e-00c443bcdaf5',
                },
            },
        });
    });

    it('should handle complex object with array and nested context values', async () => {
        const contextPosition = 'data';
        const contextData = {
            value: 'test',
            operator: 'eq',
        };

        global.addDataProcessedToGlobalContext(contextPosition, contextData);
        const sendData = {
            body: {
                search_filter: {
                    filter: [
                        {
                            operator: 'context.data.operator',
                            value: 'context.data.value',
                            type: 'AND',
                            field: 'context.field',
                        },
                    ],
                    limit: 0,
                    offset: 0,
                },
            },
        };

        const globalReplace = new GlobalContextProcessor(global);

        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual({
            body: {
                search_filter: {
                    filter: [
                        {
                            operator: contextData.operator,
                            value: contextData.value,
                            type: 'AND',
                            field: null,
                        },
                    ],
                    limit: 0,
                    offset: 0,
                },
            },
        });
    });

    it('should handle complex JSON string with context values in nested objects', async () => {
        const orbikaData = {
            functions: {
                new_stage: [
                    {
                        stage: 3,
                    },
                ],
            },
        };

        global.addDataProcessedToGlobalContext('orbika', orbikaData);

        const sendData = {
            body: {
                search_filter: {
                    filter: [
                        {
                            field: 'data',
                            operator: 'jsonContains',
                            value: '{ "code_stage": context.orbika.functions.new_stage[0].stage}',
                            type: 'AND',
                        },
                    ],
                    limit: 1,
                    offset: 0,
                },
            },
        };

        const expected = {
            filter: [
                {
                    field: 'data',
                    operator: 'jsonContains',
                    value: '{ "code_stage": 3}',
                    type: 'AND',
                },
            ],
            limit: 1,
            offset: 0,
        };

        const globalReplace = new GlobalContextProcessor(global);
        const response = await globalReplace.replace(sendData);

        expect(response.body.search_filter).toStrictEqual(expected);
    });

    it('should handle context replacement differently for keys vs values when context does not exist', async () => {
        const sendData = {
            body: {
                'context.nonexistent.key': 'context.nonexistent.value',
                normal_key: 'context.another.nonexistent',
                'context.existing.key': 'context.existing.value',
            },
        };

        global.addDataProcessedToGlobalContext('existing', {
            key: 'replaced_key',
            value: 'replaced_value',
        });

        const expected = {
            body: {
                'context_undefined.nonexistent.key': null,
                normal_key: null,
                replaced_key: 'replaced_value',
            },
        };

        const globalReplace = new GlobalContextProcessor(global);
        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(expected);
    });

    it('should replace multiple context blocks', async () => {
        const data =
            'https://5vqcbk3pia.execute-api.us-east-1.amazonaws.com/stg/get-sinister-status?late=context.aux_case.data.form_indemnizacion.PlacaVehiculo&coverage=PPD&sinister=context.case.external_code';
        const context = {
            aux_case: {
                data: {
                    form_indemnizacion: {
                        PlacaVehiculo: 'asd654',
                    },
                },
            },
            case: {
                external_code: '987654231',
            },
        };

        global.addDataProcessedToGlobalContext('aux_case.data.form_indemnizacion.PlacaVehiculo', 'asd654');
        global.addDataProcessedToGlobalContext('case.external_code', '987654321');
        const globalReplace = new GlobalContextProcessor(global);

        const result = await globalReplace.replace(data);

        expect(result).toStrictEqual(
            'https://5vqcbk3pia.execute-api.us-east-1.amazonaws.com/stg/get-sinister-status?late=asd654&coverage=PPD&sinister=987654321'
        );
    });

    it('should replace values in an object with context body nested values', async () => {
        const sendData = {
            body: {
                filter: [
                    {
                        field: 'data',
                        operator: 'jsonContains',
                        value: '{"linea":"context.data.asistencia.linea", "departamento":"context.data.asistencia.departamento", "municipio":"context.data.asistencia.municipio", "invalid":"context.data.asistencia.invalid" }',
                        type: 'AND',
                    },
                ],
                limit: 25,
                offset: 0,
            },
        };

        const expected = {
            body: {
                filter: [
                    {
                        field: 'data',
                        operator: 'jsonContains',
                        value: '{"linea":"autos","departamento":"caldas","municipio":"bello","invalid":null}',
                        type: 'AND',
                    },
                ],
                limit: 25,
                offset: 0,
            },
        };

        const initialContext = {
            case_id: '92e1edb6-3223-4496-bac7-eba9e434e8b3',
            asistencia: {
                expediente: '123456789',
                linea: 'autos',
                municipio: 'bello',
                departamento: 'caldas',
            },
        };

        const context = new GlobalContext();
        context.addDataProcessedToGlobalContext('data', initialContext);
        let a = context.get();

        const globalReplace = new GlobalContextProcessor(context);
        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(expected);
    });

    it('should replace values in an object with context body nested values and invalid ones', async () => {
        const sendData = {
            body: {
                filter: [
                    {
                        field: 'data',
                        operator: 'jsonContains',
                        value: '{ "invalid":"context.data.asistencia.invalid", "linea":"context.data.asistencia.linea", "departamento":"context.data.asistencia.departamento", "municipio":"context.data.asistencia.municipio" }',
                        type: 'AND',
                    },
                ],
                limit: 25,
                offset: 0,
            },
        };

        const expected = {
            body: {
                filter: [
                    {
                        field: 'data',
                        operator: 'jsonContains',
                        value: '{"invalid":null,"linea":"autos","departamento":"caldas","municipio":"bello"}',
                        type: 'AND',
                    },
                ],
                limit: 25,
                offset: 0,
            },
        };

        const initialContext = {
            case_id: '92e1edb6-3223-4496-bac7-eba9e434e8b3',
            asistencia: {
                expediente: '123456789',
                linea: 'autos',
                municipio: 'bello',
                departamento: 'caldas',
            },
        };

        const context = new GlobalContext();
        context.addDataProcessedToGlobalContext('data', initialContext);
        let a = context.get();

        const globalReplace = new GlobalContextProcessor(context);
        const response = await globalReplace.replace(sendData);

        expect(response).toStrictEqual(expected);
    });

    describe('array and object context values in plain text body', () => {
        it('should return the full array when plain text body references a context variable that resolves to an array of objects', async () => {
            global.addDataProcessedToGlobalContext('datos', [
                { id: 'u1', name: 'Alice' },
                { id: 'u2', name: 'Bob' },
            ]);
            const processor = new GlobalContextProcessor(global);

            const result = await processor.replace({ body: 'context.datos' });

            expect(result).toStrictEqual({
                body: [
                    { id: 'u1', name: 'Alice' },
                    { id: 'u2', name: 'Bob' },
                ],
            });
        });

        it('should return the full object when plain text body references a context variable that resolves to an object', async () => {
            global.addDataProcessedToGlobalContext('payload', { action: 'create', priority: 1 });
            const processor = new GlobalContextProcessor(global);

            const result = await processor.replace({ body: 'context.payload' });

            expect(result).toStrictEqual({ body: { action: 'create', priority: 1 } });
        });

        it('should embed the full array when a JSON body field references a context variable that resolves to an array', async () => {
            global.addDataProcessedToGlobalContext('items', [{ id: 1 }, { id: 2 }]);
            const processor = new GlobalContextProcessor(global);

            const result = await processor.replace({ body: { list: 'context.items' } });

            expect(result).toStrictEqual({ body: { list: [{ id: 1 }, { id: 2 }] } });
        });

        it('should embed the full object when a nested JSON body field references a context variable that resolves to an object', async () => {
            global.addDataProcessedToGlobalContext('sub_caso', { new_property: '' });
            const processor = new GlobalContextProcessor(global);

            const result = await processor.replace({ body: { aux_cases: { data: 'context.sub_caso' } } });

            expect(result).toStrictEqual({ body: { aux_cases: { data: { new_property: '' } } } });
        });
    });

    describe('plain text body replacement', () => {
        it('should replace a plain text body (string) containing a single context variable', async () => {
            global.addDataProcessedToGlobalContext('user', { name: 'John' });
            const processor = new GlobalContextProcessor(global);

            const result = await processor.replace({ body: 'context.user.name' });

            expect(result).toStrictEqual({ body: 'John' });
        });

        it('should replace a plain text body with a prefix and suffix around the context variable', async () => {
            global.addDataProcessedToGlobalContext('auth', { token: 'abc123' });
            const processor = new GlobalContextProcessor(global);

            const result = await processor.replace({ body: 'Bearer context.auth.token' });

            expect(result).toStrictEqual({ body: 'Bearer abc123' });
        });

        it('should return null body when context variable is not found in plain text body', async () => {
            const processor = new GlobalContextProcessor(global);

            const result = await processor.replace({ body: 'context.missing.value' });

            expect(result).toStrictEqual({ body: null });
        });

        it('should return the plain text body unchanged when it contains no context variable', async () => {
            const processor = new GlobalContextProcessor(global);

            const result = await processor.replace({ body: 'static plain text' });

            expect(result).toStrictEqual({ body: 'static plain text' });
        });
    });

    describe('context values with dataProcessed key', () => {
        it('should NOT unwrap a context value that happens to have a dataProcessed key', async () => {
            const domainValue = { dataProcessed: 'some_real_value', other: 42 };
            global.addDataProcessedToGlobalContext('mykey', domainValue);
            const processor = new GlobalContextProcessor(global);
            const result = await processor.replace({ body: 'context.mykey' });
            expect(result).toStrictEqual({ body: domainValue });
        });

        it('should NOT unwrap a context value that has exactly one dataProcessed key', async () => {
            const domainValue = { dataProcessed: 'only_key' };
            global.addDataProcessedToGlobalContext('wrapped', domainValue);
            const processor = new GlobalContextProcessor(global);
            const result = await processor.replace({ body: 'context.wrapped' });
            expect(result).toStrictEqual({ body: domainValue });
        });
    });

    describe('null and falsy value handling', () => {
        it('should preserve null values in body and resolve non-null values correctly', async () => {
            const context = new GlobalContext();
            context.addDataProcessedToGlobalContext('rabbit', {
                nmTelefono1: null,
                nombre: 'Juan',
            });

            const sendData = {
                body: {
                    telefono: 'context.rabbit.nmTelefono1',
                    nombre: 'context.rabbit.nombre',
                },
            };

            const globalReplace = new GlobalContextProcessor(context);
            const response = await globalReplace.replace(sendData);

            expect(response).toStrictEqual({
                body: {
                    telefono: null,
                    nombre: 'Juan',
                },
            });
        });

        it('should preserve falsy values (0, false, empty string) and not convert them to context_undefined', async () => {
            const context = new GlobalContext();
            context.addDataProcessedToGlobalContext('data', {
                count: 0,
                active: false,
                label: '',
            });

            const sendData = {
                body: {
                    count: 'context.data.count',
                    active: 'context.data.active',
                    label: 'context.data.label',
                },
            };

            const globalReplace = new GlobalContextProcessor(context);
            const response = await globalReplace.replace(sendData);

            expect(response).toStrictEqual({
                body: {
                    count: 0,
                    active: false,
                    label: '',
                },
            });
        });

        it('should still mark genuinely missing keys as context_undefined', async () => {
            const context = new GlobalContext();
            context.addDataProcessedToGlobalContext('data', {
                existing: 'value',
            });

            const sendData = {
                body: {
                    existing: 'context.data.existing',
                    missing: 'context.data.nonexistent',
                },
            };

            const globalReplace = new GlobalContextProcessor(context);
            const response = await globalReplace.replace(sendData);

            expect(response).toStrictEqual({
                body: {
                    existing: 'value',
                    missing: null,
                },
            });
        });

        it('should return null when string input references a null context value', async () => {
            const context = new GlobalContext();
            context.addDataProcessedToGlobalContext('data', {
                value: null,
            });

            const globalReplace = new GlobalContextProcessor(context);
            const response = await globalReplace.replace('context.data.value');

            expect(response).toBeNull();
        });

        it('should handle mixed null and valid values in nested objects', async () => {
            const context = new GlobalContext();
            context.addDataProcessedToGlobalContext('rabbit', {
                nmTelefono1: null,
                nmTelefono2: null,
                nombre: 'Juan',
                apellido: 'Perez',
                edad: 0,
            });

            const sendData = {
                body: {
                    contacto: {
                        telefono1: 'context.rabbit.nmTelefono1',
                        telefono2: 'context.rabbit.nmTelefono2',
                        nombre: 'context.rabbit.nombre',
                        apellido: 'context.rabbit.apellido',
                        edad: 'context.rabbit.edad',
                    },
                },
            };

            const globalReplace = new GlobalContextProcessor(context);
            const response = await globalReplace.replace(sendData);

            expect(response).toStrictEqual({
                body: {
                    contacto: {
                        telefono1: null,
                        telefono2: null,
                        nombre: 'Juan',
                        apellido: 'Perez',
                        edad: 0,
                    },
                },
            });
        });
    });

    describe('multi-line strings with context variables', () => {
        it('should replace multiple context variables inside a string with quotes and literal backslash-n', async () => {
            const context = new GlobalContext();
            context.addDataProcessedToGlobalContext('gestion_novedades', {
                observacion: 'Se reporta falla en el equipo',
                quien_reporta_la_novedad: 'Juan Perez',
                causa_de_la_novedad: 'Desgaste natural',
            });

            const sendData = {
                body: {
                    bitacora:
                        '"\'Gestion novedades \\n Observacion: context.gestion_novedades.observacion \\n Quien reporta la novedad: context.gestion_novedades.quien_reporta_la_novedad \\n Causa de la novedad: context.gestion_novedades.causa_de_la_novedad \\n ."',
                },
            };

            const expected = {
                body: {
                    bitacora:
                        '"\'Gestion novedades \\n Observacion: Se reporta falla en el equipo \\n Quien reporta la novedad: Juan Perez \\n Causa de la novedad: Desgaste natural \\n ."',
                },
            };

            const globalReplace = new GlobalContextProcessor(context);
            const response = await globalReplace.replace(sendData);

            expect(response).toStrictEqual(expected);
        });

        it('should replace context variables in a string with actual newline characters (\\n)', async () => {
            const context = new GlobalContext();
            context.addDataProcessedToGlobalContext('gestion_novedades', {
                observacion: 'Observacion test',
                quien_reporta_la_novedad: 'Maria Lopez',
                causa_de_la_novedad: 'Fallo eléctrico',
            });

            const sendData = {
                body: {
                    bitacora: `Gestion novedades\nObservacion: context.gestion_novedades.observacion\nQuien reporta: context.gestion_novedades.quien_reporta_la_novedad\nCausa: context.gestion_novedades.causa_de_la_novedad`,
                },
            };

            const expected = {
                body: {
                    bitacora: `Gestion novedades\nObservacion: Observacion test\nQuien reporta: Maria Lopez\nCausa: Fallo eléctrico`,
                },
            };

            const globalReplace = new GlobalContextProcessor(context);
            const response = await globalReplace.replace(sendData);

            expect(response).toStrictEqual(expected);
        });

        it('should not hang on unresolvable context references (infinite loop protection)', async () => {
            const context = new GlobalContext();

            const sendData = {
                body: {
                    bitacora:
                        'Gestion novedades \n Observacion: context.gestion_novedades.observacion \n Causa: context.gestion_novedades.causa',
                },
            };

            const globalReplace = new GlobalContextProcessor(context);
            const response = await globalReplace.replace(sendData);

            expect(response).toStrictEqual({
                body: {
                    bitacora: 'Gestion novedades \n Observacion: null \n Causa: null',
                },
            });
        }, 5000);
    });
});
