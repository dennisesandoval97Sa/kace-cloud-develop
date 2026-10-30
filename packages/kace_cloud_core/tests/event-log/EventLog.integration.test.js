import {
    KnexEventRepository,
    EventCreator,
    EventFinder,
    EventSearcher,
    EventCollectionResponse,
    EventResponse,
    EventSearcherByCaseId,
} from '../../src/event-log/index.js';
import { knexConfig } from '../knexfile.js';
import EventLogMother from './domain/EventLogMother.js';
import { v4 as uuid } from 'uuid';
import { Counter, CustomError } from '../../src/shared/index.js';

describe('EventLog Integration Tests', () => {
    const repository = new KnexEventRepository(knexConfig);

    it('should create an EventLog', async () => {
        const dto = EventLogMother.dto();
        const creator = new EventCreator(repository);

        await creator.execute(dto);

        const result = await repository.connection('event_logs').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
    });

    it('can find an existing EventLog', async () => {
        const eventLog = await EventLogMother.createEventLog(repository);
        const finder = new EventFinder(repository);

        const result = await finder.execute(eventLog.id.value);

        expect(result).toBeInstanceOf(EventResponse);
        const { data } = result.toJson();

        expect(data.id).toBe(eventLog.id.value);
    });

    it('throws error when finding non-existent EventLog', async () => {
        const finder = new EventFinder(repository);

        await expect(finder.execute(uuid())).rejects.toThrow(CustomError);
    });

    it('can search EventLogs', async () => {
        for (let i = 0; i < 5; i++) {
            await EventLogMother.createEventLog(repository);
        }

        const searcher = new EventSearcher(repository);
        const result = await searcher.execute({
            filter: undefined,
            relationship: undefined,
            limit: 5,
            offset: 0,
            order: { field: 'occurred_at', direction: 'desc' },
        });

        expect(result).toBeInstanceOf(EventCollectionResponse);

        const { data } = result.toJson();

        expect(data.items.length).toBe(5);
    });

    it('can count EventLogs by client_id', async () => {
        const commonClientId = uuid();

        for (let i = 0; i < 3; i++) {
            const dto = EventLogMother.dto({ client_id: commonClientId });
            await new EventCreator(repository).execute(dto);
        }

        const counter = new Counter(repository);
        const count = await counter.execute({
            filters: [{ field: 'client_id', operator: '=', value: commonClientId }],
        });

        expect(Number(count.count)).toBe(3);
    });

    it('should search EventLogs by case_id', async () => {
        const commonCaseId = uuid();

        for (let i = 0; i < 5; i++) {
            const dto = EventLogMother.dto({ case_id: commonCaseId });
            await new EventCreator(repository).execute(dto);
        }

        const searcherByCaseId = new EventSearcherByCaseId(repository);
        const result = await searcherByCaseId.execute(commonCaseId, {});

        expect(result).toBeInstanceOf(EventCollectionResponse);

        const { data } = result.toJson();

        expect(data.items.length).toBe(5);
    });

    it('should count EventLogs by client_id', async () => {
        const commonCaseId = uuid();

        for (let i = 0; i < 5; i++) {
            const dto = EventLogMother.dto({ case_id: commonCaseId });
            await new EventCreator(repository).execute(dto);
        }

        const searcherByCaseId = new EventSearcherByCaseId(repository);
        const result = await searcherByCaseId.execute(commonCaseId, {
            filter: undefined,
            relationship: undefined,
            limit: 2,
            offset: 0,
            order: { field: 'occurred_at', direction: 'desc' },
        });

        expect(result).toBeInstanceOf(EventCollectionResponse);

        const { metadata } = result.toJson();
        expect(Number(metadata.count)).toBe(5);
    });
});
