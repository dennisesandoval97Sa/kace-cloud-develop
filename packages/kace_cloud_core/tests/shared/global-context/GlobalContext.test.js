import { GlobalContext } from '../../../src/shared/domain/global-context/GlobalContext';
import { httpResponseData } from './domain/GlobalContextMother';

describe('Global Context test', () => {
    it('add data to global context', () => {
        const response = {
            data: {
                index: 'prueba',
                key: 'key test',
            },
        };
        const globalContext = {
            context: {
                funcition1: response,
            },
        };

        const contextPosition = 'funcition1';

        const global = new GlobalContext();

        global.addDataProcessedToGlobalContext(contextPosition, response);

        expect(global.get()).toStrictEqual(globalContext);
    });

    it('get by filter_input', async () => {
        const step1 = {
            data: {
                fecha: '2025/04/11 ',
                fecha2: '2025-04-12',
                precio: 1000000,
                producto: 'carro',
            },
            status: 200,
        };
        const filter_input = ['step1.data.fecha', 'step1.data.fecha2'];

        const result = {
            dataProcessed: {
                fecha: '2025/04/11 ',
                fecha2: '2025-04-12',
            },
            resolved: true,
        };
        const global = new GlobalContext();

        global.addDataProcessedToGlobalContext('step1', step1);

        const response = await global.getByFilterInput(filter_input);
        expect(response).toStrictEqual(result);
    });

    it('process data to received', async () => {
        const filterInput = ['data.fecha2', 'status', 'message'];

        const contextPosition = 'step1';

        const global = {
            context: {
                step1: {
                    fecha2: '2025-04-12',
                    status: 200,
                    message: 'susseccfuly',
                },
            },
        };

        const globalContext = new GlobalContext();

        await globalContext.processDataReceived(filterInput, contextPosition, httpResponseData);

        expect(globalContext.get()).toStrictEqual(global);
    });

    it('add initialContext to global context', () => {
        const initialContext = {
            caso_id: 23,
        };
        const contextPosition = 'initial_context';

        const global = new GlobalContext();
        global.addDataProcessedToGlobalContext(contextPosition, initialContext);

        expect(global.get()).toStrictEqual({ context: { initial_context: { caso_id: 23 } } });
    });

    it('only adds dataProcessed to global context', () => {
        const globalContext = new GlobalContext();

        const initialData = {
            data: {
                fecha: '2025/04/11',
                precio: 1000000,
                producto: 'carro',
            },
            status: 200,
        };

        const contextPosition = 'step1';
        const filterInput = ['step1.fecha', 'step1.precio'];

        const processedResult = {
            dataProcessed: {
                fecha: '2025/04/11',
                precio: 1000000,
            },
            resolved: true,
        };
        globalContext.addDataProcessedToGlobalContext(contextPosition, initialData.data);

        const result = globalContext.getByFilterInput(filterInput);

        expect(result).toStrictEqual(processedResult);

        globalContext.processDataReceived(filterInput, 'resultado', globalContext.get().context);

        const expectedContext = {
            context: {
                step1: initialData.data,
                resultado: processedResult.dataProcessed,
            },
        };

        expect(globalContext.get()).toStrictEqual(expectedContext);
    });

    it('merges arrays of primitives in the global context', () => {
        const globalContext = new GlobalContext();

        globalContext.addDataProcessedToGlobalContext('step1.items', [1, 2, 3]);
        globalContext.addDataProcessedToGlobalContext('step1.items', [4, 5]);

        expect(globalContext.get()).toStrictEqual({
            context: {
                step1: {
                    items: [1, 2, 3, 4, 5],
                },
            },
        });
    });

    it('merges arrays of objects in the global context', () => {
        const globalContext = new GlobalContext();

        globalContext.addDataProcessedToGlobalContext('step1.items', [{ id: 1 }, { id: 2 }]);
        globalContext.addDataProcessedToGlobalContext('step1.items', [{ id: 3 }]);

        expect(globalContext.get()).toStrictEqual({
            context: {
                step1: {
                    items: [{ id: 1 }, { id: 2 }, { id: 3 }],
                },
            },
        });
    });

    it('overwrites value when existing is not an array', () => {
        const globalContext = new GlobalContext();

        globalContext.addDataProcessedToGlobalContext('step1.items', 42);
        globalContext.addDataProcessedToGlobalContext('step1.items', [1, 2]);

        expect(globalContext.get()).toStrictEqual({
            context: {
                step1: {
                    items: [1, 2],
                },
            },
        });
    });

    it('merges arrays with mixed types gracefully', () => {
        const globalContext = new GlobalContext();

        globalContext.addDataProcessedToGlobalContext('step1.items', [1, { a: 'a' }]);
        globalContext.addDataProcessedToGlobalContext('step1.items', ['string', true]);

        expect(globalContext.get()).toStrictEqual({
            context: {
                step1: {
                    items: [1, { a: 'a' }, 'string', true],
                },
            },
        });
    });

    it('merges only arrays and overwrites objects', () => {
        const globalContext = new GlobalContext();

        globalContext.addDataProcessedToGlobalContext('step1.items', [1, 2]);
        globalContext.addDataProcessedToGlobalContext('step1.items', [3]);

        globalContext.addDataProcessedToGlobalContext('step1.meta', { a: 1 });
        globalContext.addDataProcessedToGlobalContext('step1.meta', { b: 2 });

        expect(globalContext.get()).toStrictEqual({
            context: {
                step1: {
                    items: [1, 2, 3],
                    meta: { b: 2 },
                },
            },
        });
    });

    it('modifies a specific position in an array using contextPosition', () => {
        const globalContext = new GlobalContext();

        globalContext.addDataProcessedToGlobalContext('step1.items', [1, 2, 3]);

        const contextPosition = 'step1.items[2]';
        const newItem = 4;

        globalContext.addDataProcessedToGlobalContext(contextPosition, newItem);

        expect(globalContext.get()).toStrictEqual({
            context: {
                step1: {
                    items: [1, 2, 4],
                },
            },
        });
    });

    describe('null and falsy value handling', () => {
        it('should store null as a valid value in the global context', () => {
            const globalContext = new GlobalContext();

            globalContext.addDataProcessedToGlobalContext('step1.value', null);

            expect(globalContext.get()).toStrictEqual({
                context: {
                    step1: {
                        value: null,
                    },
                },
            });
        });

        it('should store 0 and false as valid values in the global context', () => {
            const globalContext = new GlobalContext();

            globalContext.addDataProcessedToGlobalContext('step1.count', 0);
            globalContext.addDataProcessedToGlobalContext('step1.active', false);

            expect(globalContext.get()).toStrictEqual({
                context: {
                    step1: {
                        count: 0,
                        active: false,
                    },
                },
            });
        });

        it('should retrieve null values correctly via getByFilterInput', () => {
            const globalContext = new GlobalContext();

            globalContext.addDataProcessedToGlobalContext('rabbit', {
                nmTelefono1: null,
                nombre: 'Juan',
            });

            const result = globalContext.getByFilterInput(['rabbit.nmTelefono1', 'rabbit.nombre']);

            expect(result).toStrictEqual({
                dataProcessed: {
                    nmTelefono1: null,
                    nombre: 'Juan',
                },
                resolved: true,
            });
        });
    });
});
