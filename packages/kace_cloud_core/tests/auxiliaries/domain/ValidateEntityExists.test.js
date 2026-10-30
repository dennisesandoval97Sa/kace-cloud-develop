import { ValidateEntityExists } from '../../../src/auxiliaries/domain/ValidateEntityExists.js';
import { ValidationFailError } from '../../../src/shared/index.js';
import { QueryDBError } from '../../../src/shared/errors/QueryDBError.js';
import { knexConfig } from '../../knexfile.js';
import { KnexAuxiliariesRepository } from '../../../src/auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository.js';
import { jest } from '@jest/globals';

describe('ValidateEntityExists', () => {
    let validateEntityExists;
    let mockRepository;
    const repository = new KnexAuxiliariesRepository(knexConfig);

    beforeEach(async () => {
        mockRepository = {
            getSchemaTables: jest.fn(),
        };
        validateEntityExists = new ValidateEntityExists(mockRepository);
    });

    it('Valida correctamente una entidad real en base de datos', async () => {
        const entity = 'aux_cases';
        const tables = await repository.getSchemaTables();

        await expect(tables).toContain(entity);
    });

    it('debería validar correctamente cuando la entidad existe', async () => {
        const entity = 'aux_cases';
        const tables = ['aux_cases', 'aux_usuarios', 'aux_roles'];
        mockRepository.getSchemaTables.mockResolvedValue(tables);

        await expect(validateEntityExists.execute(entity)).resolves.not.toThrow();
        expect(mockRepository.getSchemaTables).toHaveBeenCalled();
    });

    it('debería lanzar ValidationFailError cuando la entidad no existe', async () => {
        const entity = 'non_existent_entity';
        const tables = ['aux_cases', 'aux_usuarios', 'aux_roles'];
        mockRepository.getSchemaTables.mockResolvedValue(tables);

        await expect(validateEntityExists.execute(entity)).rejects.toThrow(ValidationFailError);

        expect(mockRepository.getSchemaTables).toHaveBeenCalled();
    });

    it('debería lanzar ValidationFailError cuando la entidad es null', async () => {
        await expect(validateEntityExists.execute(null)).rejects.toThrow(ValidationFailError);

        expect(mockRepository.getSchemaTables).not.toHaveBeenCalled();
    });

    it('debería lanzar ValidationFailError cuando la entidad es undefined', async () => {
        await expect(validateEntityExists.execute(undefined)).rejects.toThrow(ValidationFailError);

        expect(mockRepository.getSchemaTables).not.toHaveBeenCalled();
    });

    it('debería lanzar ValidationFailError cuando la entidad es una cadena vacía', async () => {
        await expect(validateEntityExists.execute('')).rejects.toThrow(ValidationFailError);

        expect(mockRepository.getSchemaTables).not.toHaveBeenCalled();
    });

    it('debería lanzar ValidationFailError cuando la entidad es una cadena con solo espacios', async () => {
        await expect(validateEntityExists.execute('   ')).rejects.toThrow(ValidationFailError);

        expect(mockRepository.getSchemaTables).not.toHaveBeenCalled();
    });

    it('debería lanzar ValidationFailError cuando la entidad no es una cadena', async () => {
        await expect(validateEntityExists.execute(123)).rejects.toThrow(ValidationFailError);

        expect(mockRepository.getSchemaTables).not.toHaveBeenCalled();
    });

    it('debería propagar QueryDBError cuando hay un error en la base de datos', async () => {
        const entity = 'aux_cases';
        const dbError = new QueryDBError('custom', 'getSchema fail');
        mockRepository.getSchemaTables.mockRejectedValue(dbError);

        await expect(validateEntityExists.execute(entity)).rejects.toThrow(QueryDBError);

        expect(mockRepository.getSchemaTables).toHaveBeenCalled();
    });
});
