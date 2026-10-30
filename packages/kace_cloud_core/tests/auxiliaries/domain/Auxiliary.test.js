import { Auxiliary } from '../../../src/auxiliaries/domain/Auxiliary.js';
import { AuxiliaryMother } from './AuxiliaryMother.js';
import { ValueObjectTimestamp } from '../../../src/shared/index.js';

describe('Auxiliary', () => {
    it('debería crear una instancia de Auxiliary válida', () => {
        const dto = AuxiliaryMother.dto();
        const auxiliary = Auxiliary.create(dto);

        expect(auxiliary).toBeInstanceOf(Auxiliary);
        expect(auxiliary.data.value).toEqual(dto.data);
        expect(auxiliary.created_at.value).toBe(dto.created_at);
        expect(auxiliary.created_by.value).toBe(dto.created_by);
        expect(auxiliary.updated_at.value).toBe(dto.updated_at);
        expect(auxiliary.updated_by.value).toBe(dto.updated_by);
        expect(auxiliary.deleted_at.value).toBe(dto.deleted_at);
        expect(auxiliary.deleted_by.value).toBe(dto.deleted_by);
    });

    it('debería lanzar error si los datos están vacíos', () => {
        const dto = AuxiliaryMother.dto();
        dto.data = {};

        expect(() => Auxiliary.create(dto)).toThrow();
    });

    it('debería lanzar error si no se proporcionan datos', () => {
        expect(() => Auxiliary.create({})).toThrow();
        expect(() => Auxiliary.create(null)).toThrow();
        expect(() => Auxiliary.create(undefined)).toThrow();
    });

    it('debería actualizar los datos correctamente', () => {
        const dto = AuxiliaryMother.dto();
        const auxiliary = Auxiliary.create(dto);
        const newData = {
            nombre: 'Nuevo Auxiliary',
            descripcion: 'Nueva Descripción',
            codigo: 'NEW-001',
            estado: 'inactivo',
            tipo: 'especial',
        };

        auxiliary.data = newData;

        expect(auxiliary.data.value).toEqual(newData);
        expect(JSON.parse(auxiliary.changedAttributes.data)).toEqual(newData);
    });

    it('debería lanzar error si se intenta actualizar con datos vacíos', () => {
        const dto = AuxiliaryMother.dto();
        const auxiliary = Auxiliary.create(dto);

        expect(() => {
            auxiliary.data = {};
        }).toThrow();
    });

    it('debería manejar correctamente los campos de auditoría', () => {
        const dto = AuxiliaryMother.dto();
        const auxiliary = Auxiliary.create(dto);

        expect(auxiliary.created_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(auxiliary.created_by.value).toBeDefined();
        expect(auxiliary.updated_at.value).toBeNull();
        expect(auxiliary.updated_by.value).toBeNull();
        expect(auxiliary.deleted_at.value).toBeNull();
        expect(auxiliary.deleted_by.value).toBeNull();
    });

    it('debería permitir datos con diferentes estructuras', () => {
        const dto = AuxiliaryMother.dto();
        dto.data = {
            campo1: 'valor1',
            campo2: 123,
            campo3: true,
            campo4: {
                subcampo: 'subvalor',
            },
        };

        const auxiliary = Auxiliary.create(dto);

        expect(auxiliary.data.value).toEqual(dto.data);
    });

    it('debería permitir actualizar arrays correctamente mediante el método update', () => {
        const dto = AuxiliaryMother.dto();
        const auxiliary = Auxiliary.create(dto);

        const initialData = {
            nombre: 'Auxiliary 1',
            categorias: ['categoria1', 'categoria2'],
            detalles: [{ key: 'a', value: 10 }],
        };

        auxiliary.update({ data: initialData });

        const updatedData = {
            nombre: 'Auxiliary 1 Updated',
            categorias: ['categoria3', 'categoria2'],
            detalles: [
                { key: 'a', value: 10 },
                { key: 'b', value: 20 },
            ],
        };

        auxiliary.update({ data: updatedData });

        expect(auxiliary.data.value.categorias).toEqual(['categoria1', 'categoria2', 'categoria3']);
        expect(auxiliary.data.value.detalles).toEqual([
            { key: 'a', value: 10 },
            { key: 'b', value: 20 },
        ]);
    });

    it('debería manejar correctamente la fusión de arrays de objetos con el método update', () => {
        const dto = AuxiliaryMother.dto();
        const auxiliary = Auxiliary.create(dto);

        const initialData = {
            items: [
                { id: 1, name: 'item1' },
                { id: 2, name: 'item2' },
            ],
        };

        auxiliary.update({ data: initialData });

        const updatedData = {
            items: [
                { id: 2, name: 'item2' },
                { id: 3, name: 'item3' },
            ],
        };

        auxiliary.update({ data: updatedData });

        expect(auxiliary.data.value.items).toEqual([
            { id: 1, name: 'item1' },
            { id: 2, name: 'item2' },
            { id: 3, name: 'item3' },
        ]);
    });

    it('debería manejar correctamente la fusión de arrays con valores primitivos', () => {
        const dto = AuxiliaryMother.dto();
        const auxiliary = Auxiliary.create(dto);

        const initialData = {
            valores: [1, 2, 3],
        };

        auxiliary.update({ data: initialData });

        const updatedData = {
            valores: [4, 5, 3],
        };

        auxiliary.update({ data: updatedData });

        expect(auxiliary.data.value.valores).toEqual([1, 2, 3, 4, 5]);
    });

    it('debería mantener la integridad de datos no modificados durante la fusión', () => {
        const dto = AuxiliaryMother.dto();
        const auxiliary = Auxiliary.create(dto);

        const initialData = {
            nombre: 'Auxiliary 1',
            categorias: ['categoria1', 'categoria2'],
        };

        auxiliary.update({ data: initialData });

        const updatedData = {
            categorias: ['categoria3'],
        };

        auxiliary.update({ data: updatedData });

        expect(auxiliary.data.value.nombre).toBe('Auxiliary 1');
        expect(auxiliary.data.value.categorias).toEqual(['categoria1', 'categoria2', 'categoria3']);
    });
});
