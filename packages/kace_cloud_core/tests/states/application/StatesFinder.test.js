import { knexConfig } from '../../knexfile.js';
import {
    KnexClassificationsLevelDistinctionRepository,
    StatesDistinctionFinder,
    StatesDistinctionResponse,
} from '../../../src/states/index.js';

describe('StatesDistinctionFinder', () => {
    const repository = new KnexClassificationsLevelDistinctionRepository(knexConfig);

    it('should get a list of the all states to case', async () => {
        const statesDistinctionFinder = new StatesDistinctionFinder(repository);
        const result = await statesDistinctionFinder.execute();

        expect(result).toBeInstanceOf(StatesDistinctionResponse);
    });
});
