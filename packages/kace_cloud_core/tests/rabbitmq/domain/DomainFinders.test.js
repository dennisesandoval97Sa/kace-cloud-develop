import { jest } from '@jest/globals';
import { DomainAdapterFinder } from '../../../src/rabbitmq/domain/DomainAdapterFinder.js';
import { DomainMapperFinder } from '../../../src/rabbitmq/domain/DomainMapperFinder.js';

// Ambas clases envuelven un repositorio "duck-typed" (KnexAdapterSettingsRepository implementa
// findById+findByName, pero KnexMapperRepository de hoy NO implementa findByName). El guard
// `this.#repository.findByName ? ... : null` existe justamente para tolerar esa asimetria, asi
// que probarlo con un repositorio real que carece del metodo (o con un doble que si lo tiene)
// ejercita exactamente lo que la clase esta protegiendo, sin sustituir ninguna llamada a BD real.
describe.each([
    ['DomainAdapterFinder', DomainAdapterFinder],
    ['DomainMapperFinder', DomainMapperFinder],
])('%s', (_name, FinderClass) => {
    it('delegates to repository.findById(id) when the repository implements it', async () => {
        const record = { id: 'abc-123', name: 'Found' };
        const repository = { findById: jest.fn().mockResolvedValue(record) };
        const finder = new FinderClass(repository);

        const result = await finder.execute('abc-123');

        expect(repository.findById).toHaveBeenCalledWith('abc-123');
        expect(result).toBe(record);
    });

    it('returns null without throwing when the repository does not implement findById', async () => {
        const repository = {};
        const finder = new FinderClass(repository);

        const result = await finder.execute('abc-123');

        expect(result).toBeNull();
    });

    it('delegates to repository.findByName(name) when the repository implements it', async () => {
        const record = { id: 'abc-123', name: 'ByName' };
        const repository = { findByName: jest.fn().mockResolvedValue(record) };
        const finder = new FinderClass(repository);

        const result = await finder.findByName('ByName');

        expect(repository.findByName).toHaveBeenCalledWith('ByName');
        expect(result).toBe(record);
    });

    it('returns null without throwing when the repository does not implement findByName', async () => {
        const repository = {};
        const finder = new FinderClass(repository);

        const result = await finder.findByName('ByName');

        expect(result).toBeNull();
    });
});
