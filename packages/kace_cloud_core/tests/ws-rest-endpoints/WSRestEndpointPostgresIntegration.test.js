import { WSRestEndpoint } from '../../src/ws-rest-endpoints/domain/WSRestEndpoint.js';
import { WSRestEndpointCreator } from '../../src/ws-rest-endpoints/application/create/WSRestEndpointCreator.js';
import { WSRestEndpointUpdater } from '../../src/ws-rest-endpoints/application/update/WSRestEndpointUpdater.js';
import { WSRestEndpointFinder } from '../../src/ws-rest-endpoints/application/find/WSRestEndpointFinder.js';
import { KnexWSRestEndpointRepository } from '../../src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { WSRestEndpointResponse } from '../../src/ws-rest-endpoints/application/WSRestEndpointResponse.js';
import WSRestEndpointMother from './domain/WSRestEndpointMother.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';

describe('WSRestEndpoint PostgreSQL Integration Tests', () => {
    const repository = new KnexWSRestEndpointRepository(knexConfig);

    it('should create a WSRestEndpoint with plain_text body_type and persist string body', async () => {
        const dto = WSRestEndpointMother.dto({
            body: { body: 'Hello, this is plain text content' },
            body_type: 'plain_text',
        });
        const wsRestEndpointCreator = new WSRestEndpointCreator(repository);

        await wsRestEndpointCreator.execute(dto);

        const result = await repository.find({ value: dto.id });
        expect(result).toBeInstanceOf(WSRestEndpoint);
        expect(result.body_type.value).toBe('plain_text');
        expect(result.body.value.body).toBe('Hello, this is plain text content');
    });

    it('should read back a plain_text endpoint and expose body_type in response', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository, {
            body: { body: 'plain text body content' },
            body_type: 'plain_text',
        });
        const wsRestEndpointFinder = new WSRestEndpointFinder(repository);

        const response = await wsRestEndpointFinder.execute(wsRestEndpoint.id.value);

        expect(response).toBeInstanceOf(WSRestEndpointResponse);
        const data = response.toJson().data;
        expect(data.body_type).toBe('plain_text');
        expect(data.body.body).toBe('plain text body content');
    });

    it('should default to body_type json when not provided', async () => {
        const dto = WSRestEndpointMother.dto();
        delete dto.body_type;
        const wsRestEndpointCreator = new WSRestEndpointCreator(repository);

        await wsRestEndpointCreator.execute(dto);

        const result = await repository.find({ value: dto.id });
        expect(result.body_type.value).toBe('json');
    });

    it('should update body_type from json to plain_text', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository, {
            body: { body: { key: 'value' } },
            body_type: 'json',
        });
        const wsRestEndpointUpdater = new WSRestEndpointUpdater(repository);

        await wsRestEndpointUpdater.execute(wsRestEndpoint.id.value, {
            body: { body: 'updated plain text' },
            body_type: 'plain_text',
        });

        const result = await repository.find(wsRestEndpoint.id);
        expect(result.body_type.value).toBe('plain_text');
        expect(result.body.value.body).toBe('updated plain text');
    });
});
