import { BoardResourcesResponse } from '../../src/boards/application/BoardResourcesResponse.js';

describe('BoardResourcesResponse', () => {
    it('devuelve un objeto vacio cuando la fila es null/undefined', () => {
        expect(new BoardResourcesResponse(null).toJson()).toEqual({});
        expect(new BoardResourcesResponse(undefined).toJson()).toEqual({});
    });

    it('devuelve data con las propiedades de la fila cuando existe', () => {
        const row = { id: '1', nombre: 'x' };

        expect(new BoardResourcesResponse(row).toJson()).toEqual({ data: { id: '1', nombre: 'x' } });
    });
});
