import { AuxDefinitionsMother } from '../domain/AuxDefinitionsMother.js';
import { AuxDefinitionCollectionResponse } from '../../../src/aux_definitions/application/AuxDefinitionCollectionResponse.js';

describe('AuxDefinitionCollectionResponse', () => {
    it('debería convertir una colección de AuxDefinition a JSON con metadatos', () => {
        const items = [AuxDefinitionsMother.create(), AuxDefinitionsMother.create()];
        const count = items.length;
        const response = new AuxDefinitionCollectionResponse(items, count);
        const json = response.toJson();
        expect(json).toHaveProperty('data');
        expect(json.data).toHaveProperty('items');
        expect(Array.isArray(json.data.items)).toBe(true);
        expect(json.data.items.length).toBe(count);
        expect(json).toHaveProperty('metadata');
        expect(json.metadata.count).toBe(count);
    });

    it('debería manejar una colección vacía', () => {
        const response = new AuxDefinitionCollectionResponse([], 0);
        const json = response.toJson();
        expect(json.data.items).toEqual([]);
        expect(json.metadata.count).toBe(0);
    });
});
