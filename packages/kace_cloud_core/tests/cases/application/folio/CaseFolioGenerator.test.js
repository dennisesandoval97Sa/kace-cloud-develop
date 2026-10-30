import { jest } from '@jest/globals';
import { CaseFolioGenerator } from '../../../../src/cases/application/folio/CaseFolioGenerator.js';

describe('CaseFolioGenerator', () => {
    let generator;
    let repositoryMock;
    let config;

    beforeEach(() => {
        repositoryMock = {
            countCreatedToday: jest.fn(),
        };
        config = {
            add_folio_to_external_code: true,
            folio_length: 4,
        };
        generator = new CaseFolioGenerator(repositoryMock);
    });

    it('should return external code unchanged when add_folio_to_external_code is false', async () => {
        config.add_folio_to_external_code = false;

        const result = await generator.execute('M20260119', config);

        expect(result).toBe('M20260119');
        expect(repositoryMock.countCreatedToday).not.toHaveBeenCalled();
    });

    it('should return null when external code is null', async () => {
        const result = await generator.execute(null, config);

        expect(result).toBe(null);
        expect(repositoryMock.countCreatedToday).not.toHaveBeenCalled();
    });

    it('should return external code unchanged when config is null', async () => {
        const result = await generator.execute('M20260119', null);

        expect(result).toBe('M20260119');
        expect(repositoryMock.countCreatedToday).not.toHaveBeenCalled();
    });

    it('should generate folio correctly by calling countCreatedToday', async () => {
        repositoryMock.countCreatedToday.mockResolvedValue(0);

        const result = await generator.execute('M20260119', config);

        expect(result).toBe('M202601190001');
        expect(repositoryMock.countCreatedToday).toHaveBeenCalledWith('M20260119%', null);
    });

    it('should increment count to produce the next folio number', async () => {
        repositoryMock.countCreatedToday.mockResolvedValue(3);

        const result = await generator.execute('PREFIX', config);

        expect(result).toBe('PREFIX0004');
        expect(repositoryMock.countCreatedToday).toHaveBeenCalledWith('PREFIX%', null);
    });

    it('should pass excludeId to repository when provided', async () => {
        const excludeId = 'some-case-id';
        repositoryMock.countCreatedToday.mockResolvedValue(3);

        const result = await generator.execute('PREFIX', config, excludeId);

        expect(result).toBe('PREFIX0004');
        expect(repositoryMock.countCreatedToday).toHaveBeenCalledWith('PREFIX%', excludeId);
    });

    it('should handle overflow by truncating the folio', async () => {
        repositoryMock.countCreatedToday.mockResolvedValue(9999);

        const result = await generator.execute('PREFIX', config);

        expect(result).toBe('PREFIX0000');
    });

    it('should use default folio length of 4 when not specified in config', async () => {
        delete config.folio_length;
        repositoryMock.countCreatedToday.mockResolvedValue(0);

        const result = await generator.execute('PREFIX', config);

        expect(result).toBe('PREFIX0001');
    });
});
