import { jest } from '@jest/globals';
import { GroupsExistenceValidator } from '../../src/boards/domain/GroupsExistenceValidator.js';

describe('GroupsExistenceValidator', () => {
    const buildRepository = (existingIds) => ({ findExistingIds: jest.fn(async () => existingIds) });

    it('no consulta el repositorio cuando no se pasan groupIds (usa el default [])', async () => {
        // Arrange
        const repository = buildRepository([]);
        const validator = new GroupsExistenceValidator(repository);

        // Act
        await validator.validate();

        // Assert
        expect(repository.findExistingIds).not.toHaveBeenCalled();
    });

    it('no lanza cuando todos los groupIds existen', async () => {
        // Arrange
        const repository = buildRepository(['g1', 'g2']);
        const validator = new GroupsExistenceValidator(repository);

        // Act & Assert
        await expect(validator.validate(['g1', 'g2'])).resolves.toBeUndefined();
    });

    it('lanza ValidationFailError listando los groupIds que no existen', async () => {
        // Arrange
        const repository = buildRepository(['g1']);
        const validator = new GroupsExistenceValidator(repository);

        // Act & Assert
        await expect(validator.validate(['g1', 'g2'])).rejects.toMatchObject({
            message: 'The following groups do not exist: g2',
            field: 'access_groups',
        });
    });
});
