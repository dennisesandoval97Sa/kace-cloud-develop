import { jest } from '@jest/globals';
import { CommentBatchCreator } from '../../src/comments/index.js';
import CommentsMother from './domain/CommentsMother.js';

const buildRepository = (overrides = {}) => {
    const transaction = { commit: jest.fn().mockResolvedValue(), rollback: jest.fn().mockResolvedValue() };
    return {
        transaction,
        save: jest.fn().mockResolvedValue(),
        saveHistory: jest.fn().mockResolvedValue(),
        startTransaction: jest.fn().mockResolvedValue(transaction),
        ...overrides,
    };
};

describe('CommentBatchCreator', () => {
    it('creates every comment inside a single transaction and returns their ids', async () => {
        const repository = buildRepository();
        const dtos = [CommentsMother.dto(), CommentsMother.dto(), CommentsMother.dto()];

        const ids = await new CommentBatchCreator(repository).execute(dtos);

        expect(ids).toEqual(dtos.map((dto) => dto.id));
        expect(repository.startTransaction).toHaveBeenCalledTimes(1);
        expect(repository.save).toHaveBeenCalledTimes(dtos.length);
        expect(repository.saveHistory).toHaveBeenCalledTimes(dtos.length);
        expect(repository.save).toHaveBeenCalledWith(expect.anything(), repository.transaction);
        expect(repository.transaction.commit).toHaveBeenCalledTimes(1);
        expect(repository.transaction.rollback).not.toHaveBeenCalled();
    });

    it('uses the caller transaction and leaves commit/rollback to the caller when one is provided', async () => {
        const repository = buildRepository();
        const callerTrx = { commit: jest.fn(), rollback: jest.fn() };
        const dtos = [CommentsMother.dto(), CommentsMother.dto()];

        const ids = await new CommentBatchCreator(repository).execute(dtos, callerTrx);

        expect(ids).toEqual(dtos.map((dto) => dto.id));
        expect(repository.startTransaction).not.toHaveBeenCalled();
        expect(repository.save).toHaveBeenCalledTimes(dtos.length);
        expect(repository.save).toHaveBeenCalledWith(expect.anything(), callerTrx);
        expect(repository.saveHistory).toHaveBeenCalledWith(expect.anything(), null, callerTrx);
        expect(callerTrx.commit).not.toHaveBeenCalled();
        expect(callerTrx.rollback).not.toHaveBeenCalled();
    });

    it('propagates the error without rolling back when the caller owns the transaction', async () => {
        const repository = buildRepository({ save: jest.fn().mockRejectedValue(new Error('db down')) });
        const callerTrx = { commit: jest.fn(), rollback: jest.fn() };

        await expect(new CommentBatchCreator(repository).execute([CommentsMother.dto()], callerTrx)).rejects.toThrow(
            'db down'
        );
        expect(callerTrx.rollback).not.toHaveBeenCalled();
        expect(callerTrx.commit).not.toHaveBeenCalled();
    });

    it('throws for a non-array input', async () => {
        const repository = buildRepository();
        await expect(new CommentBatchCreator(repository).execute({})).rejects.toThrow('non-empty array');
        expect(repository.startTransaction).not.toHaveBeenCalled();
    });

    it('throws for an empty array', async () => {
        const repository = buildRepository();
        await expect(new CommentBatchCreator(repository).execute([])).rejects.toThrow('non-empty array');
        expect(repository.startTransaction).not.toHaveBeenCalled();
    });

    it('rolls back the whole batch when a save fails', async () => {
        const dtos = [CommentsMother.dto(), CommentsMother.dto()];
        const repository = buildRepository({
            save: jest.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('db down')),
        });

        await expect(new CommentBatchCreator(repository).execute(dtos)).rejects.toThrow('db down');
        expect(repository.transaction.commit).not.toHaveBeenCalled();
        expect(repository.transaction.rollback).toHaveBeenCalledTimes(1);
    });

    it('rolls back the whole batch when saving the history fails', async () => {
        const dtos = [CommentsMother.dto(), CommentsMother.dto()];
        const repository = buildRepository({
            saveHistory: jest.fn().mockRejectedValueOnce(new Error('history down')),
        });

        await expect(new CommentBatchCreator(repository).execute(dtos)).rejects.toThrow('history down');
        expect(repository.transaction.commit).not.toHaveBeenCalled();
        expect(repository.transaction.rollback).toHaveBeenCalledTimes(1);
        expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('surfaces the original error even when the rollback itself fails', async () => {
        const dtos = [CommentsMother.dto()];
        const repository = buildRepository({
            save: jest.fn().mockRejectedValue(new Error('db down')),
        });
        repository.transaction.rollback = jest.fn().mockRejectedValue(new Error('rollback down'));

        await expect(new CommentBatchCreator(repository).execute(dtos)).rejects.toThrow('db down');
        expect(repository.transaction.commit).not.toHaveBeenCalled();
    });
});
