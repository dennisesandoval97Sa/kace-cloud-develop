import AnsMother from '../../ans/domain/AnsMother.js';
import { KnexAnsRepository } from '../../../src/ans/index.js';
import { knexConfig } from '../../knexfile.js';
import { UniquenessValidator, ValidationFailError } from '../../../src/shared/index.js';
import { RESOURCE_ALREADY_EXISTS } from '@kace/error-codes';

describe('UniquenessValidator', () => {
    const repository = new KnexAnsRepository(knexConfig);
    const validator = new UniquenessValidator(repository);

    it('should throw CustomError when duplicates are found', async () => {
        const validations = [{ field: 'nombre', value: 'Ans Oro' }];
        await AnsMother.createAns(repository);

        await expect(validator.validateMultiple(validations)).rejects.toThrow(ValidationFailError);
        await expect(validator.validateMultiple(validations)).rejects.toThrow(
            `The following value(s) already exist: ${validations[0].field} '${validations[0].value}'`
        );
        await expect(validator.validateMultiple(validations)).rejects.toMatchObject({
            publicErrorCode: RESOURCE_ALREADY_EXISTS,
        });
    });

    it('should not throw error when no duplicates are found', async () => {
        const validations = [{ field: 'nombre', value: 'Ans Diferente' }];

        await expect(validator.validateMultiple(validations)).resolves.not.toThrow();
    });

    it('should exclude specified ID from duplicate check', async () => {
        const validations = [{ field: 'nombre', value: 'Ans Oro' }];
        const existingAns = await AnsMother.createAns(repository);

        await expect(validator.validateMultiple(validations, existingAns.id.value)).resolves.not.toThrow();
    });

    it('should validate a single field without throwing an error if no duplicates are found', async () => {
        const fieldName = 'nombre';
        const value = 'Ans Test';

        await AnsMother.createAns(repository);

        await expect(validator.validate(fieldName, value)).resolves.not.toThrow();
    });

    it('should throw a CustomError if a duplicate is found', async () => {
        const fieldName = 'nombre';
        const value = 'Ans Oro';

        await AnsMother.createAns(repository);

        await expect(validator.validate(fieldName, value)).rejects.toThrow(ValidationFailError);
    });
});
