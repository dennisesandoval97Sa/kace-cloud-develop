import { jest } from '@jest/globals';
import Knex from 'knex';
import { CaseBulkCloser } from '../../src/cases/index.js';
import { CommentBatchCreator } from '../../src/comments/index.js';
import UsersMother from '../users/domain/UsersMother';
import { User } from '../../src/users';
import { EventLogger } from '../../src/shared/EventLogger.js';

const CASE_IDS = ['6f1c2d4e-0b7a-4c1e-9a55-1d2b3c4d5e61', '7a2d3e5f-1c8b-4d2f-8b66-2e3c4d5e6f72'];

describe('CaseBulkCloser', () => {
    const user = new User({ permissions: {}, ...UsersMother.dto() });
    let trx;
    let order;
    let casesRepository;
    let commentsRepository;

    beforeEach(() => {
        jest.spyOn(EventLogger.prototype, 'log').mockImplementation(async () => {
            order.push('event-log');
        });
        order = [];
        trx = { id: 'trx' };
        casesRepository = {
            connection: Knex({ client: 'pg' }),
            findByIds: jest.fn().mockResolvedValue(CASE_IDS.map((id) => ({ id, fecha_resolucion: null }))),
            bulkClose: jest.fn().mockImplementation(async () => {
                order.push('bulk-close');
            }),
            withTransaction: jest.fn().mockImplementation(async (callback) => {
                order.push('tx-begin');
                const result = await callback(trx);
                order.push('tx-commit');
                return result;
            }),
        };
        commentsRepository = {
            startTransaction: jest.fn(),
            save: jest.fn().mockImplementation(async () => {
                order.push('comment-save');
            }),
            saveHistory: jest.fn().mockResolvedValue(),
        };
    });

    afterEach(() => jest.restoreAllMocks());

    it('creates the close comments inside the close transaction with the same trx', async () => {
        await new CaseBulkCloser(casesRepository, user, commentsRepository).execute(CASE_IDS, 'Resolved bulk');

        expect(commentsRepository.startTransaction).not.toHaveBeenCalled();
        expect(commentsRepository.save).toHaveBeenCalledTimes(2);
        expect(commentsRepository.save).toHaveBeenCalledWith(expect.anything(), trx);
        expect(commentsRepository.saveHistory).toHaveBeenCalledWith(expect.anything(), null, trx);
        expect(order.indexOf('comment-save')).toBeGreaterThan(order.indexOf('bulk-close'));
        expect(order.lastIndexOf('comment-save')).toBeLessThan(order.indexOf('tx-commit'));
        expect(order.indexOf('event-log')).toBeGreaterThan(order.indexOf('tx-commit'));
    });

    it('rejects an invalid comment before the close transaction commits', async () => {
        const batchSpy = jest.spyOn(CommentBatchCreator.prototype, 'execute');

        await expect(
            new CaseBulkCloser(casesRepository, user, commentsRepository).execute(CASE_IDS, 'ab')
        ).rejects.toBeDefined();

        expect(batchSpy).toHaveBeenCalled();
        expect(order).not.toContain('tx-commit');
        expect(order).not.toContain('event-log');
    });

    it('does not touch comments when no comments repository is provided', async () => {
        await new CaseBulkCloser(casesRepository, user).execute(CASE_IDS, 'Resolved bulk');

        expect(commentsRepository.save).not.toHaveBeenCalled();
    });
});
