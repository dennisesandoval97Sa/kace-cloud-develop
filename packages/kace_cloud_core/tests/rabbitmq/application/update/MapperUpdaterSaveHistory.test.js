import { MapperUpdater } from '../../../../src/rabbitmq/application/update/MapperUpdater.js';
import { KnexMapperRepository } from '../../../../src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { knexConfig } from '../../../knexfile.js';
import MapperMother from '../../domain/MapperMother.js';

// NOTA: el test "should not fail when repository does not have saveHistory" en
// tests/rabbitmq/application/ConsumeMessageUseCase.test.js usa el `KnexMapperRepository` REAL,
// que SI hereda `saveHistory` de `KnexRepository` (src/shared/infrastructure/persistence/
// KnexRepository.js:233) -- pese a su nombre, ese test NUNCA ejercita la rama "false" de
// `if (this.#repository.saveHistory)` (MapperUpdater.js:32). Aqui se cubre esa rama con un
// colaborador que de verdad carece del metodo (delegando find/update a la instancia real, sin
// mockear ninguna llamada a la base de datos).
describe('MapperUpdater.saveHistory guard (false branch)', () => {
    it('skips saveHistory entirely when the collaborator does not implement it at all', async () => {
        const realRepository = new KnexMapperRepository(knexConfig);
        const dto = MapperMother.dto();
        await realRepository.create(dto);
        const repositoryWithoutSaveHistory = {
            findById: realRepository.findById.bind(realRepository),
            update: realRepository.update.bind(realRepository),
        };
        expect(repositoryWithoutSaveHistory.saveHistory).toBeUndefined();
        const updater = new MapperUpdater(repositoryWithoutSaveHistory);

        const result = await updater.execute(dto.id, { name: 'Updated Without History Collaborator' });

        expect(result.name).toBe('Updated Without History Collaborator');
        const stored = await realRepository.findById(dto.id);
        expect(stored.name).toBe('Updated Without History Collaborator');
    });
});
