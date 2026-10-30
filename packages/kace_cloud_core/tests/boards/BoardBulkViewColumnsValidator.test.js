import { jest } from '@jest/globals';
import { BoardBulkViewColumnsValidator } from '../../src/boards/domain/BoardBulkViewColumnsValidator.js';
import { SchemaMetadataCache, ValidationFailError } from '../../src/shared/index.js';

describe('BoardBulkViewColumnsValidator', () => {
    const repository = { connection: {} };
    let getTableColumnsSpy;

    afterEach(() => {
        getTableColumnsSpy?.mockRestore();
    });

    const mockColumns = (columns) => {
        getTableColumnsSpy = jest.spyOn(SchemaMetadataCache, 'getTableColumns').mockResolvedValue(columns);
    };

    it('does nothing when called without params (uses the default {})', async () => {
        mockColumns([]);
        const validator = new BoardBulkViewColumnsValidator(repository);
        await expect(validator.validate()).resolves.toBeUndefined();
        expect(getTableColumnsSpy).not.toHaveBeenCalled();
    });

    it('does nothing when bulk actions are disabled', async () => {
        mockColumns([]);
        const validator = new BoardBulkViewColumnsValidator(repository);
        await expect(
            validator.validate({
                primary_entity: 'boards_cases_open',
                can_admin_bulk_actions: false,
                can_agent_bulk_actions: false,
            })
        ).resolves.toBeUndefined();
        expect(getTableColumnsSpy).not.toHaveBeenCalled();
    });

    it('does not introspect the real cases table', async () => {
        mockColumns([]);
        const validator = new BoardBulkViewColumnsValidator(repository);
        await expect(
            validator.validate({ primary_entity: 'cases', can_admin_bulk_actions: true })
        ).resolves.toBeUndefined();
        expect(getTableColumnsSpy).not.toHaveBeenCalled();
    });

    it('does not validate non cases-like entities', async () => {
        mockColumns([]);
        const validator = new BoardBulkViewColumnsValidator(repository);
        await expect(
            validator.validate({ primary_entity: 'boards_clientes', can_admin_bulk_actions: true })
        ).resolves.toBeUndefined();
        expect(getTableColumnsSpy).not.toHaveBeenCalled();
    });

    it('passes when the view exposes all required columns', async () => {
        mockColumns(['id', 'fecha_resolucion', 'transicion_id', 'titulo']);
        const validator = new BoardBulkViewColumnsValidator(repository);
        await expect(
            validator.validate({ primary_entity: 'boards_cases_open', can_agent_bulk_actions: true })
        ).resolves.toBeUndefined();
    });

    it('throws when a required column is missing', async () => {
        mockColumns(['id', 'titulo']);
        const validator = new BoardBulkViewColumnsValidator(repository);
        await expect(
            validator.validate({ primary_entity: 'boards_cases_open', can_admin_bulk_actions: true })
        ).rejects.toThrow(ValidationFailError);
    });
});
