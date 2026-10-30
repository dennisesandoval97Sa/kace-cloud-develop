import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { InteractionBatchCreator } from '../../src/interactions/application/create/InteractionBatchCreator.js';
import { InteractionEmailAlreadyLinkedError } from '../../src/interactions/domain/InteractionEmailAlreadyLinkedError.js';
import InteractionMother from './domain/InteractionMother.js';

const buildRepository = (overrides = {}) => {
    const transaction = { commit: jest.fn().mockResolvedValue(), rollback: jest.fn().mockResolvedValue() };
    return {
        transaction,
        find: jest.fn().mockResolvedValue(null),
        findByEmailIds: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockResolvedValue(),
        saveHistory: jest.fn().mockResolvedValue(),
        startTransaction: jest.fn().mockResolvedValue(transaction),
        ...overrides,
    };
};

describe('InteractionBatchCreator', () => {
    it('creates every interaction inside a single transaction and returns their ids', async () => {
        const repository = buildRepository();
        const dtos = [InteractionMother.dto(), InteractionMother.dto(), InteractionMother.dto()];

        const ids = await new InteractionBatchCreator(repository).execute(dtos);

        expect(ids).toEqual(dtos.map((dto) => dto.id));
        expect(repository.startTransaction).toHaveBeenCalledTimes(1);
        expect(repository.save).toHaveBeenCalledTimes(dtos.length);
        expect(repository.saveHistory).toHaveBeenCalledTimes(dtos.length);
        expect(repository.save).toHaveBeenCalledWith(expect.anything(), repository.transaction);
        expect(repository.transaction.commit).toHaveBeenCalledTimes(1);
        expect(repository.transaction.rollback).not.toHaveBeenCalled();
    });

    it('throws for a non-array input', async () => {
        const repository = buildRepository();
        await expect(new InteractionBatchCreator(repository).execute({})).rejects.toThrow('non-empty array');
        expect(repository.startTransaction).not.toHaveBeenCalled();
    });

    it('throws for an empty array', async () => {
        const repository = buildRepository();
        await expect(new InteractionBatchCreator(repository).execute([])).rejects.toThrow('non-empty array');
        expect(repository.startTransaction).not.toHaveBeenCalled();
    });

    it('rolls back the whole batch when an id collides with an existing row', async () => {
        const dtos = [InteractionMother.dto(), InteractionMother.dto()];
        const repository = buildRepository({
            // The id is generated server-side, so a collision only surfaces from the insert (PK).
            save: jest
                .fn()
                .mockResolvedValueOnce()
                .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "interactions_pkey"')),
        });

        await expect(new InteractionBatchCreator(repository).execute(dtos)).rejects.toThrow('interactions_pkey');
        expect(repository.transaction.commit).not.toHaveBeenCalled();
        expect(repository.transaction.rollback).toHaveBeenCalledTimes(1);
        expect(repository.save).toHaveBeenCalledTimes(2);
    });

    it('checks linked emails once per batch and on the transaction', async () => {
        const emailIds = [uuidv4(), uuidv4()];
        const dtos = [
            InteractionMother.dto({ email_id: emailIds[0] }),
            InteractionMother.dto({ email_id: emailIds[1] }),
            InteractionMother.dto({ email_id: null }),
        ];
        const repository = buildRepository();

        await new InteractionBatchCreator(repository).execute(dtos);

        expect(repository.findByEmailIds).toHaveBeenCalledTimes(1);
        expect(repository.findByEmailIds).toHaveBeenCalledWith(emailIds, { trx: repository.transaction });
    });

    it('does not query linked emails when no item has an email_id', async () => {
        const repository = buildRepository();

        await new InteractionBatchCreator(repository).execute([InteractionMother.dto({ email_id: null })]);

        expect(repository.findByEmailIds).not.toHaveBeenCalled();
    });

    it('rolls back the whole batch when a save fails', async () => {
        const dtos = [InteractionMother.dto(), InteractionMother.dto()];
        const repository = buildRepository({
            save: jest.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('db down')),
        });

        await expect(new InteractionBatchCreator(repository).execute(dtos)).rejects.toThrow('db down');
        expect(repository.transaction.commit).not.toHaveBeenCalled();
        expect(repository.transaction.rollback).toHaveBeenCalledTimes(1);
    });

    it('rejects when an email_id is already linked to an existing interaction', async () => {
        const emailId = uuidv4();
        const dtos = [InteractionMother.dto({ email_id: emailId })];
        const repository = buildRepository({
            findByEmailIds: jest.fn().mockResolvedValue([{ id: { value: uuidv4() }, email_id: { value: emailId } }]),
        });

        await expect(new InteractionBatchCreator(repository).execute(dtos)).rejects.toBeInstanceOf(
            InteractionEmailAlreadyLinkedError
        );
        expect(repository.transaction.rollback).toHaveBeenCalledTimes(1);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects when two items in the same batch link the same email_id', async () => {
        const emailId = uuidv4();
        const dtos = [InteractionMother.dto({ email_id: emailId }), InteractionMother.dto({ email_id: emailId })];
        const repository = buildRepository();

        await expect(new InteractionBatchCreator(repository).execute(dtos)).rejects.toBeInstanceOf(
            InteractionEmailAlreadyLinkedError
        );
        expect(repository.transaction.commit).not.toHaveBeenCalled();
        expect(repository.transaction.rollback).toHaveBeenCalledTimes(1);
        // The duplicate is detected before any insert is attempted.
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('translates a DB email-unique violation into InteractionEmailAlreadyLinkedError', async () => {
        const dtos = [InteractionMother.dto({ email_id: uuidv4() })];
        const uniqueError = new Error('duplicate key value violates unique constraint "interactions_email_id_unique"');
        uniqueError.constraint = 'interactions_email_id_unique';
        const repository = buildRepository({
            save: jest.fn().mockRejectedValue(uniqueError),
        });

        await expect(new InteractionBatchCreator(repository).execute(dtos)).rejects.toBeInstanceOf(
            InteractionEmailAlreadyLinkedError
        );
        expect(repository.transaction.rollback).toHaveBeenCalledTimes(1);
    });
});
