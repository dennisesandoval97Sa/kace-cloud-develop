import { knexConfig } from '../../knexfile.js';
import KnexClassificationsLevelDistinctionRepository from '../../../src/ClassificationsLevelDistinction/infrasctructure/KnexClassificationsLevelDistinctionRepository.js';
import { KnexClassificationRepository } from '../../../src/classifications/index.js';
import ClassificationsMother from '../../classifications/domain/ClassificationsMother.js';
import ClassificationsLevelDistinctionFinder from '../../../src/ClassificationsLevelDistinction/application/ClassificationsLevelDistinctionFinder.js';
import ClassificationsLevelDistinctionResponse from '../../../src/ClassificationsLevelDistinction/application/ClassificationsLevelDistinctionResponse.js';
import { ValidationFailError } from '../../../src/shared/index.js';

describe('ClassificationsLevelDistinctionFinder', () => {
    const repository = new KnexClassificationsLevelDistinctionRepository(knexConfig);
    const classificationRepository = new KnexClassificationRepository(repository.connection);

    it('should get a list of the values of classifications.nivel1', async () => {
        const classificationLevelDistinctionFinder = new ClassificationsLevelDistinctionFinder(repository);
        // La semilla ya deja clasificaciones en la tabla (`nivel1: 'Categoria'`),
        // asi que la lista esperada es la union de lo que ya habia con lo nuevo.
        const initialResult = await classificationLevelDistinctionFinder.execute('nivel1');
        const initialItems = initialResult.toJson().data.items;

        const countries = ['Argentina', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Peru', 'Uruguay', 'Venezuela'];
        for (const country of countries) {
            await ClassificationsMother.create(classificationRepository, { nivel1: country });
        }

        const result = await classificationLevelDistinctionFinder.execute('nivel1');

        expect(result).toBeInstanceOf(ClassificationsLevelDistinctionResponse);
        // `distinct` no lleva `order by`: se comparan conjuntos, no orden.
        expect([...result.toJson().data.items].sort()).toEqual([...new Set([...initialItems, ...countries])].sort());
    });

    it('should throw an error when the level is invalid', async () => {
        const classificationLevelDistinctionFinder = new ClassificationsLevelDistinctionFinder(repository);

        await expect(classificationLevelDistinctionFinder.execute('invalid')).rejects.toThrow(ValidationFailError);
    });
});
