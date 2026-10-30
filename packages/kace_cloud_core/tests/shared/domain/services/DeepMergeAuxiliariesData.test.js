import { DeepMergeAuxiliariesData } from '../../../../src/shared/domain/services/DeepMergeAuxiliariesData';

describe('DeepMergeAuxiliariesData', () => {
    it('should merge simple objects correctly', () => {
        const target = { a: 1, b: 2 };
        const source = { b: 3, c: 4 };

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested objects correctly', () => {
        const target = { a: { x: 1 }, b: 2 };
        const source = { a: { y: 2 }, c: 3 };

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual({ a: { x: 1, y: 2 }, b: 2, c: 3 });
    });

    it('should merge arrays correctly', () => {
        const target = { items: [1, 2] };
        const source = { items: [3, 4] };

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual({ items: [1, 2, 3, 4] });
    });

    it('should handle primitive values correctly', () => {
        const target = { a: 1 };
        const source = { a: 2 };

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual({ a: 2 });
    });

    it('should return the target unchanged if either value is not an object', () => {
        const target = { a: 1 };
        const source = [1, 2, 3];

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual(target);
    });

    it('should correctly handle missing properties in the target', () => {
        const target = { a: 1 };
        const source = { b: 2 };

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should correctly handle empty objects', () => {
        const target = {};
        const source = { a: 1 };

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual({ a: 1 });
    });

    it('should correctly handle when the source is empty', () => {
        const target = { a: 1 };
        const source = {};

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual({ a: 1 });
    });

    it('should return the original object if there are no changes', () => {
        const target = { a: 1 };
        const source = { a: 1 };

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual(target);
    });

    it('should merge deeply nested objects and arrays, handling all types correctly', () => {
        const target = {
            a: 1,
            b: {
                x: 10,
                y: 20,
                arr: [1, 2, 3],
                nestedObj: {
                    prop1: 'value1',
                    prop2: 'value2',
                },
            },
            c: [1, 2],
            d: 'stringValue',
            e: null,
        };

        const source = {
            b: {
                x: 100,
                arr: [4, 5],
                nestedObj: {
                    prop2: 'newValue',
                    prop3: 'newProperty',
                },
            },
            c: [3, 4],
            d: 'newString',
            e: 'newNullValue',
            f: {
                newProp: 'addedNewProp',
            },
        };

        const result = DeepMergeAuxiliariesData.execute(target, source);

        expect(result).toEqual({
            a: 1,
            b: {
                x: 100,
                y: 20,
                arr: [1, 2, 3, 4, 5],
                nestedObj: {
                    prop1: 'value1',
                    prop2: 'newValue',
                    prop3: 'newProperty',
                },
            },
            c: [1, 2, 3, 4],
            d: 'newString',
            e: 'newNullValue',
            f: {
                newProp: 'addedNewProp',
            },
        });
    });

    it('should add new items', () => {
        const target = {
            nombre: 'Jose',
            contactos: [
                { tipo: 'email', valor: 'jose@local.com' },
                { tipo: 'telefono', valor: '9876543210' },
            ],
        };
        const source = {
            nombre: 'Jose',
            contactos: [
                { tipo: 'email', valor: 'jose@local.com' },
                { tipo: 'telefono', valor: '1234567890' },
            ],
        };

        const result = DeepMergeAuxiliariesData.execute(target, source, false);

        expect(result).toEqual({
            nombre: 'Jose',
            contactos: [
                { tipo: 'email', valor: 'jose@local.com' },
                { tipo: 'telefono', valor: '9876543210' },
                { tipo: 'telefono', valor: '1234567890' },
            ],
        });
    });

    it('should override items', () => {
        const existingValue = {
            nombre: 'Jose',
            contactos: [
                { tipo: 'email', valor: 'jose@local.com' },
                { tipo: 'telefono', valor: '9876543210' },
                { tipo: 'telefono', valor: '1234554321' },
            ],
        };
        const newValue = {
            nombre: 'Jose',
            contactos: [
                { tipo: 'email', valor: 'roberto@local.com' },
                { tipo: 'telefono', valor: '1234567890' },
            ],
        };

        const expectValue = {
            nombre: 'Jose',
            contactos: [
                { tipo: 'email', valor: 'roberto@local.com' },
                { tipo: 'telefono', valor: '1234567890' },
            ],
        };

        const result = DeepMergeAuxiliariesData.execute(existingValue, newValue, true);

        expect(result).toEqual(expectValue);
    });

    it('should override items 2', () => {
        const existingValue = {
            nombre: 'Jose',
            contactos: [
                { tipo: 'email', valor: 'jose@local.com' },
                { tipo: 'telefono', valor: '9876543210' },
                { tipo: 'fax', valor: '1234554321' },
            ],
        };
        const newValue = {
            nombre: 'Jose',
            contactos: [
                { tipo: 'email', valor: 'roberto@local.com' },
                { tipo: 'telefono', valor: '1234567890' },
            ],
        };

        const expectValue = {
            nombre: 'Jose',
            contactos: [
                { tipo: 'email', valor: 'roberto@local.com' },
                { tipo: 'telefono', valor: '1234567890' },
            ],
        };

        const result = DeepMergeAuxiliariesData.execute(existingValue, newValue, true);

        expect(result).toStrictEqual(expectValue);
    });

    it('should override items 2', () => {
        const existingValue = {
            nombre: 'Jose',
            contactos: [
                { dependiente: 'si', dependency: 'x' },
                { dependiente: 'si', dependency: 'y' },
                { dependiente: 'si', dependency: 'z' },
                { dependiente: 'no' },
            ],
        };
        const newValue = {
            nombre: 'Jose',
            contactos: [
                { dependiente: 'si', dependency: 'a' },
                { dependiente: 'si', dependency: 'y' },
                { dependiente: 'si', dependency: 'z' },
            ],
        };

        const expectValue = {
            nombre: 'Jose',
            contactos: [
                { dependiente: 'si', dependency: 'a' },
                { dependiente: 'si', dependency: 'y' },
                { dependiente: 'si', dependency: 'z' },
            ],
        };

        const result = DeepMergeAuxiliariesData.execute(existingValue, newValue, true);

        console.log(result);
        expect(result).toStrictEqual(expectValue);
    });

    it('should override arrays but preserve nested objects not in source when shouldOverrideArray is true', () => {
        const target = {
            asistencia: {
                placa: 'HMD111',
                contactos: [{ tipo: 'email', valor: 'a@b.com' }],
                notificacion_push: {
                    fecha_envio_1: '2026-05-06T00:30:00Z',
                    mensaje_sms: 'Hola',
                },
            },
        };
        const source = {
            asistencia: {
                placa: 'ABC123',
                contactos: [{ tipo: 'telefono', valor: '123456' }],
            },
        };

        const result = DeepMergeAuxiliariesData.execute(target, source, true);

        expect(result.asistencia.contactos).toEqual([{ tipo: 'telefono', valor: '123456' }]);
        expect(result.asistencia.placa).toBe('ABC123');
        expect(result.asistencia.notificacion_push).toEqual({
            fecha_envio_1: '2026-05-06T00:30:00Z',
            mensaje_sms: 'Hola',
        });
    });
});
