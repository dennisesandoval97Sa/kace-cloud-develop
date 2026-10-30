import { AdapterResponse } from '../../src/rabbitmq/application/AdapterResponse.js';
import { MapperResponse } from '../../src/rabbitmq/application/MapperResponse.js';

describe('AdapterResponse', () => {
    it('returns an empty object when constructed with no adapter', () => {
        const response = new AdapterResponse(null);

        expect(response.toJson()).toEqual({});
    });
});

describe('MapperResponse', () => {
    // `MapperResponse` acepta cualquier objeto con esa forma (no necesariamente un `Mapper`
    // real: `Mapper` siempre normaliza `rules` a un array, asi que `this.rules ?? []` es
    // inalcanzable pasando una instancia real de `Mapper`). Se construye directamente con un
    // objeto plano sin `rules` para ejercitar el fallback.
    it('defaults rules to an empty array when the source object omits it', () => {
        const response = new MapperResponse({
            id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
            name: 'Test mapper',
            rest_flow_id: 'flow-1',
            queue: 'q1',
        });

        expect(response.toJson().data.rules).toEqual([]);
    });
});
