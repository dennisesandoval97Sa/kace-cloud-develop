import { v4 as uuidv4 } from 'uuid';
import { KnexAdapterSettingsRepository } from '../../../src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository.js';
import { knexConfig } from '../../knexfile.js';

describe('KnexAdapterSettingsRepository.search() without criteria.convertToKnex', () => {
    const repository = new KnexAdapterSettingsRepository(knexConfig);

    it('falls back to the base (unfiltered) query when criteria has no convertToKnex', async () => {
        const name = `NoConvert-${uuidv4()}`;
        await repository.connection('broker_adapters').insert({
            id: uuidv4(),
            name,
            host: 'broker.local',
            port: 5672,
            queue: 'q1',
        });

        const results = await repository.search({});

        expect(results.some((a) => a.name === name)).toBe(true);
    });
});
