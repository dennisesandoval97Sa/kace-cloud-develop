import { AuxiliaryMother } from './domain/AuxiliaryMother.js';
import { AuxiliaryCollectionResponse } from '../../src/auxiliaries/application/AuxiliaryCollectionResponse.js';
import { AuxiliaryListCollectionResponse } from '../../src/auxiliaries/application/AuxiliaryListCollectionResponse.js';
import { Auxiliary } from '../../src/auxiliaries/domain/Auxiliary.js';
import { AuxiliaryResponse } from '../../src/auxiliaries/application/AuxiliaryResponse.js';

describe('AuxiliaryCollectionResponse', () => {
    it('debería convertir una colección de Auxiliary a JSON con metadatos', () => {
        const items = [new Auxiliary(AuxiliaryMother.dto()), new Auxiliary(AuxiliaryMother.dto())];
        const count = items.length;
        const response = new AuxiliaryCollectionResponse(items, count);
        const json = response.toJson();

        expect(json).toHaveProperty('data');
        expect(json.data).toHaveProperty('items');
        expect(Array.isArray(json.data.items)).toBe(true);
        expect(json.data.items.length).toBe(count);
        expect(json).toHaveProperty('metadata');
        expect(json.metadata.count).toBe(count);
    });

    it('debería manejar una colección vacía', () => {
        const response = new AuxiliaryCollectionResponse([], 0);
        const json = response.toJson();

        expect(json.data.items).toEqual([]);
        expect(json.metadata.count).toBe(0);
    });

    it('debería manejar una colección con múltiples elementos', () => {
        const items = [
            new Auxiliary(AuxiliaryMother.dto({ data: { nombre: 'Auxiliary 1', codigo: 'AUX-001' } })),
            new Auxiliary(AuxiliaryMother.dto({ data: { nombre: 'Auxiliary 2', codigo: 'AUX-002' } })),
            new Auxiliary(AuxiliaryMother.dto({ data: { nombre: 'Auxiliary 3', codigo: 'AUX-003' } })),
        ];
        const count = items.length;
        const response = new AuxiliaryCollectionResponse(items, count);
        const json = response.toJson();

        expect(json.data.items.length).toBe(3);
        expect(json.metadata.count).toBe(3);
        expect(json.data.items[0].data.nombre).toBe('Auxiliary 1');
        expect(json.data.items[1].data.nombre).toBe('Auxiliary 2');
        expect(json.data.items[2].data.nombre).toBe('Auxiliary 3');
    });

    it('debería mantener la estructura correcta de cada elemento', () => {
        const customData = {
            nombre: 'Test Auxiliary',
            descripcion: 'Test Description',
            codigo: 'TEST-001',
        };
        const item = new Auxiliary(AuxiliaryMother.dto({ data: customData }));
        const response = new AuxiliaryCollectionResponse([item], 1);
        const json = response.toJson();

        expect(json.data.items[0]).toHaveProperty('id');
        expect(json.data.items[0]).toHaveProperty('data');
        expect(json.data.items[0]).toHaveProperty('created_at');
        expect(json.data.items[0]).toHaveProperty('created_by');
        expect(json.data.items[0].data).toEqual(customData);
    });
});

describe('AuxiliaryResponse', () => {
    it('debería convertir una Auxiliary válida a JSON', () => {
        const dto = AuxiliaryMother.dto();
        const auxiliary = new Auxiliary(dto);
        const response = new AuxiliaryResponse(auxiliary);
        const json = response.toJson();

        expect(json).toHaveProperty('data');
        expect(json.data).toMatchObject({
            id: dto.id,
            data: dto.data,
            created_at: dto.created_at,
            created_by: dto.created_by,
            updated_at: dto.updated_at,
            updated_by: dto.updated_by,
            deleted_at: dto.deleted_at,
            deleted_by: dto.deleted_by,
        });
    });

    it('debería devolver un objeto vacío si la Auxiliary es null', () => {
        const response = new AuxiliaryResponse(null);
        expect(response.toJson()).toEqual({});
    });

    it('debería devolver un objeto vacío si la Auxiliary es undefined', () => {
        const response = new AuxiliaryResponse(undefined);
        expect(response.toJson()).toEqual({});
    });

    it('debería manejar correctamente los datos personalizados', () => {
        const customData = {
            nombre: 'Test Auxiliary',
            descripcion: 'Test Description',
            codigo: 'TEST-001',
            estado: 'activo',
            tipo: 'general',
            campo_personalizado: 'valor_personalizado',
        };
        const dto = AuxiliaryMother.dto({ data: customData });
        const auxiliary = new Auxiliary(dto);
        const response = new AuxiliaryResponse(auxiliary);
        const json = response.toJson();

        expect(json.data.data).toEqual(customData);
    });
});

describe('AuxiliaryListCollectionResponse', () => {
    it('debería retornar un objeto proyectado en data y metadata.count', () => {
        const projected = { auxcli_activo: true, auxcli_tel1: 123123 };
        const response = new AuxiliaryListCollectionResponse(projected, 2);
        const json = response.toJson();

        expect(json.data).toEqual(projected);
        expect(json.metadata.count).toBe(2);
    });

    it('debería retornar un array proyectado en data y metadata.count', () => {
        const projected = ['A', 'B', 'C'];
        const response = new AuxiliaryListCollectionResponse(projected, 3);
        const json = response.toJson();

        expect(Array.isArray(json.data)).toBe(true);
        expect(json.data).toEqual(['A', 'B', 'C']);
        expect(json.metadata.count).toBe(3);
    });

    it('debería retornar un valor primitivo y count = 1', () => {
        const response = new AuxiliaryListCollectionResponse(true, 1);
        const json = response.toJson();

        expect(json.data).toBe(true);
        expect(json.metadata.count).toBe(1);
    });

    it('debería manejar valor indefinido/null con count = 0', () => {
        const r1 = new AuxiliaryListCollectionResponse(undefined, 0).toJson();
        const r2 = new AuxiliaryListCollectionResponse(null, 0).toJson();

        expect(r1.data).toBeUndefined();
        expect(r1.metadata.count).toBe(0);
        expect(r2.data).toBeNull();
        expect(r2.metadata.count).toBe(0);
    });
});
