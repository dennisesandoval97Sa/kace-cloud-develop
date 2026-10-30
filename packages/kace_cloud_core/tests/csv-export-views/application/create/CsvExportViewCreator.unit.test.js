import { CsvExportViewCreator } from '../../../../src/csv-export-views/application/create/CsvExportViewCreator.js';

describe('CsvExportViewCreator', () => {
    it('throws immediately when the DTO is null or undefined, without touching the repository', async () => {
        const repository = {
            find: () => {
                throw new Error('should not be called');
            },
            save: () => {
                throw new Error('should not be called');
            },
        };
        const creator = new CsvExportViewCreator(repository);

        await expect(creator.execute(null)).rejects.toThrow('DTO cannot be null or undefined');
        await expect(creator.execute(undefined)).rejects.toThrow('DTO cannot be null or undefined');
    });
});
