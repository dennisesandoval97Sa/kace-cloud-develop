import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { CaseSessionDuration } from '../../src/case_session_durations/domain/CaseSessionDuration.js';
import { CaseSessionDurationUpdater } from '../../src/case_session_durations/application/update/CaseSessionDurationUpdater.js';
import { CaseSessionDurationDeleter } from '../../src/case_session_durations/application/delete/CaseSessionDurationDeleter.js';
import CaseSessionDurationMother from './domain/CaseSessionDurationMother.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';

describe('CaseSessionDuration Entity', () => {
    const dto = CaseSessionDurationMother.dto();

    it('should create a CaseSessionDuration with valid data', () => {
        const session = CaseSessionDuration.create(dto);
        expect(session.id.value).toBe(dto.id);
        expect(session.case_id.value).toBe(dto.case_id);
        expect(session.user_id.value).toBe(dto.user_id);
        expect(session.started_at.value).toBe(dto.started_at);
    });

    it('should update CaseSessionDuration data', () => {
        const session = CaseSessionDuration.create(dto);
        const newData = {
            finished_at: new Date().toISOString(),
        };
        session.finished_at = newData.finished_at;

        expect(session.finished_at.value).toBe(newData.finished_at);
    });

    it('should update CaseSessionDuration with event_type and justification', () => {
        const session = CaseSessionDuration.create(dto);
        session.event_type = 'FINISHED';
        session.justification = 'Task completed successfully';

        expect(session.event_type.value).toBe('FINISHED');
        expect(session.justification.value).toBe('Task completed successfully');
    });

    it('should throw an error with invalid id', () => {
        const invalidData = { ...dto, id: 'invalid-id' };
        expect(() => CaseSessionDuration.create(invalidData)).toThrow();
    });

    it('updater should persist changes', async () => {
        const sessionDto = CaseSessionDurationMother.dto();
        const session = CaseSessionDuration.create(sessionDto);

        // Helper to compute elapsed_time similarly to DB trigger
        const computeElapsed = (startIso, finishIso) => {
            if (!startIso || !finishIso) return null;
            const secs = Math.floor((new Date(finishIso) - new Date(startIso)) / 1000);
            if (Number.isNaN(secs) || secs < 0) return null;
            const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
            const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
            const ss = String(secs % 60).padStart(2, '0');
            return `${hh}:${mm}:${ss}`;
        };

        // Mock repository implementing the needed methods. The `update` mock simulates the DB trigger
        // by setting elapsed_time on the passed entity before resolving.
        const mockRepo = {
            find: jest.fn().mockResolvedValue(session),
            update: jest.fn().mockImplementation(async (entity) => {
                const start = entity.started_at?.value;
                const finish = entity.finished_at?.value;
                const computed = computeElapsed(start, finish);
                if (computed) entity.elapsed_time = computed;
            }),
            saveHistory: jest.fn().mockResolvedValue(),
        };

        const updater = new CaseSessionDurationUpdater(mockRepo);

        const updateDto = {
            finished_at: new Date().toISOString(),
        };

        const result = await updater.execute(updateDto, sessionDto.id);

        // El Updater busca con un ValueObjectUuid, no con un objeto plano: se compara el valor
        // del argumento real, igual que hace el test del deleter mas abajo.
        expect(mockRepo.find.mock.calls[0][0].value).toBe(sessionDto.id);
        expect(mockRepo.update).toHaveBeenCalled();
        const expectedElapsed = computeElapsed(session.started_at.value, updateDto.finished_at);
        expect(result.finished_at.value).toBe(updateDto.finished_at);
        expect(result.elapsed_time.value).toBe(expectedElapsed);
    });

    it('updater should persist changes with event_type and justification', async () => {
        const sessionDto = CaseSessionDurationMother.dto();
        const session = CaseSessionDuration.create(sessionDto);

        const mockRepo = {
            find: jest.fn().mockResolvedValue(session),
            update: jest.fn().mockResolvedValue(),
            saveHistory: jest.fn().mockResolvedValue(),
        };

        const updater = new CaseSessionDurationUpdater(mockRepo);

        const updateDto = {
            finished_at: new Date().toISOString(),
            event_type: 'FINISHED',
            justification: 'Task completed',
        };

        const result = await updater.execute(updateDto, sessionDto.id);

        expect(mockRepo.find.mock.calls[0][0].value).toBe(sessionDto.id);
        expect(mockRepo.update).toHaveBeenCalled();
        expect(result.event_type.value).toBe('FINISHED');
        expect(result.justification.value).toBe('Task completed');
    });

    it('updater should persist PAUSED event_type', async () => {
        const sessionDto = CaseSessionDurationMother.dto();
        const session = CaseSessionDuration.create(sessionDto);

        const mockRepo = {
            find: jest.fn().mockResolvedValue(session),
            update: jest.fn().mockResolvedValue(),
            saveHistory: jest.fn().mockResolvedValue(),
        };

        const updater = new CaseSessionDurationUpdater(mockRepo);

        const updateDto = {
            event_type: 'PAUSED',
            justification: 'Taking a break',
        };

        const result = await updater.execute(updateDto, sessionDto.id);

        expect(mockRepo.update).toHaveBeenCalled();
        expect(result.event_type.value).toBe('PAUSED');
        expect(result.justification.value).toBe('Taking a break');
    });

    it('deleter should soft delete a CaseSessionDuration', async () => {
        const sessionDto = CaseSessionDurationMother.dto();
        const session = CaseSessionDuration.create(sessionDto);
        const deletedBy = uuidv4();
        const deletedAt = new Date().toISOString();

        const mockRepo = {
            find: jest.fn().mockResolvedValue(session),
            delete: jest.fn().mockResolvedValue(),
        };

        const deleter = new CaseSessionDurationDeleter(mockRepo);

        const deleteDto = {
            deleted_at: deletedAt,
            deleted_by: deletedBy,
        };

        await deleter.execute(sessionDto.id, deleteDto);

        expect(mockRepo.find).toHaveBeenCalled();
        const findCall = mockRepo.find.mock.calls[0][0];
        expect(findCall.value).toBe(sessionDto.id);
        expect(mockRepo.delete).toHaveBeenCalledWith(session);
        expect(session.deleted_at.value).toBe(deletedAt);
        expect(session.deleted_by.value).toBe(deletedBy);
    });

    it('deleter should throw error when CaseSessionDuration not found', async () => {
        const nonExistentId = uuidv4();
        const mockRepo = {
            find: jest.fn().mockResolvedValue(null),
        };

        const deleter = new CaseSessionDurationDeleter(mockRepo);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await expect(deleter.execute(nonExistentId, deleteDto)).rejects.toThrow(CustomError);
        await expect(deleter.execute(nonExistentId, deleteDto)).rejects.toThrow(
            `CaseSessionDuration with id ${nonExistentId} does not exist.`
        );
    });
});
