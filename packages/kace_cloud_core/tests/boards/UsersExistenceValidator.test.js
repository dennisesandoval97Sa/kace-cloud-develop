import { jest } from '@jest/globals';
import { UsersExistenceValidator } from '../../src/boards/domain/UsersExistenceValidator.js';
import { ValidationFailError } from '../../src/shared/index.js';

describe('UsersExistenceValidator', () => {
    const buildRepository = (existingIds) => ({ findExistingIds: jest.fn(async () => existingIds) });

    it('no consulta el repositorio cuando no se pasan userIds (usa el default [])', async () => {
        // Arrange
        const repository = buildRepository([]);
        const validator = new UsersExistenceValidator(repository);

        // Act
        await validator.validate();

        // Assert
        expect(repository.findExistingIds).not.toHaveBeenCalled();
    });

    it('no lanza cuando todos los userIds existen', async () => {
        // Arrange
        const repository = buildRepository(['u1', 'u2']);
        const validator = new UsersExistenceValidator(repository);

        // Act & Assert
        await expect(validator.validate(['u1', 'u2'])).resolves.toBeUndefined();
    });

    it('lanza ValidationFailError listando los userIds que no existen', async () => {
        // Arrange
        const repository = buildRepository(['u1']);
        const validator = new UsersExistenceValidator(repository);

        // Act & Assert
        await expect(validator.validate(['u1', 'u2', 'u3'])).rejects.toMatchObject({
            message: 'The following users do not exist: u2, u3',
            field: 'access_users',
        });
    });
});
