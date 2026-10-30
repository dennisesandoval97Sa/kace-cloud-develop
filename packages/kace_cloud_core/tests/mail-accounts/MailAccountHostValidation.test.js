import { jest } from '@jest/globals';
import { MailAccountCreator } from '../../src/mail-accounts/application/create/MailAccountCreator.js';
import { MailAccountUpdater } from '../../src/mail-accounts/application/update/MailAccountUpdater.js';
import { MailAccount } from '../../src/mail-accounts/index.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { MAIL_ACCOUNT_HOST_NOT_ALLOWED } from '@kace/error-codes';
import MailAccountMother from './domain/MailAccountMother.js';

/**
 * When a mail account is created/updated with a host that is not registered in the
 * `allowed_connections` table, validateHost must reject with a CustomError carrying the
 * dedicated MAIL_ACCOUNT_HOST_NOT_ALLOWED public error code so the client can surface a
 * specific message instead of a generic 400.
 */
describe('MailAccount host validation error code', () => {
    // WorkflowExecutor (built in both constructors) wraps workflowStepRepository.connection in a
    // KnexRepository; a function value is used as-is by Knex instead of trying to build a client.
    const workflowStepRepository = { connection: () => ({}) };
    const noop = {};

    it('MailAccountCreator rejects a disallowed host with the dedicated public error code', async () => {
        const repository = {
            find: jest.fn().mockResolvedValue(null),
            isAllowedConnection: jest.fn().mockResolvedValue(false),
            save: jest.fn(),
            saveHistory: jest.fn(),
        };
        const creator = new MailAccountCreator(repository, noop, noop, workflowStepRepository, noop, noop, noop);
        const dto = MailAccountMother.dto({ host: 'test.com' });

        const promise = creator.execute(dto);

        await expect(promise).rejects.toBeInstanceOf(CustomError);
        await expect(promise).rejects.toMatchObject({
            statusCode: 400,
            publicErrorCode: MAIL_ACCOUNT_HOST_NOT_ALLOWED,
        });
        expect(repository.isAllowedConnection).toHaveBeenCalledWith('test.com');
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('MailAccountUpdater rejects a disallowed host with the dedicated public error code', async () => {
        const existing = MailAccount.create(MailAccountMother.dto());
        const repository = {
            find: jest.fn().mockResolvedValue(existing),
            isAllowedConnection: jest.fn().mockResolvedValue(false),
            update: jest.fn(),
            saveHistory: jest.fn(),
        };
        const updater = new MailAccountUpdater(repository, noop, noop, workflowStepRepository, noop, noop, noop);

        const promise = updater.execute(existing.id.value, { host: 'test.com' });

        await expect(promise).rejects.toBeInstanceOf(CustomError);
        await expect(promise).rejects.toMatchObject({
            statusCode: 400,
            publicErrorCode: MAIL_ACCOUNT_HOST_NOT_ALLOWED,
        });
        expect(repository.isAllowedConnection).toHaveBeenCalledWith('test.com');
        expect(repository.update).not.toHaveBeenCalled();
    });
});
