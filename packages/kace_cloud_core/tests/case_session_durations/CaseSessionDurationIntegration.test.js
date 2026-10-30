import {
    CaseSessionDuration,
    CaseSessionDurationCreator,
    CaseSessionDurationUpdater,
    CaseSessionDurationDeleter,
    KnexCaseSessionDurationRepository,
} from '../../src/case_session_durations/index.js';
import { CaseSessionDurationFinder } from '../../src/case_session_durations/application/find/CaseSessionDurationFinder.js';
// don't rely on the test Mother file here (it may be corrupted); create DTOs inline
import { v4 as uuidv4 } from 'uuid';
import CasesMother from '../cases/domain/CasesMother.js';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { ValueObjectUuid, ValidationFailError } from '../../src/shared/index.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('CaseSessionDuration Integration Tests', () => {
    const repository = new KnexCaseSessionDurationRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(knexConfig);

    /**
     * `case_session_durations.user_id` referencia `usuarios`: el id inventado por el test tiene que
     * existir de verdad en Postgres o el INSERT muere por la clave foranea.
     */
    const sessionDto = async (overrides = {}) => {
        const dto = buildSessionDto(overrides);
        await ensureParentRow(repository.connection, 'usuarios', dto.user_id);
        return dto;
    };

    const buildSessionDto = (overrides = {}) => ({
        id: overrides.id ?? uuidv4(),
        case_id: overrides.case_id ?? uuidv4(),
        user_id: overrides.user_id ?? uuidv4(),
        started_at: overrides.started_at ?? new Date().toISOString(),
        finished_at: overrides.finished_at ?? null,
        elapsed_time: overrides.elapsed_time ?? null,
        // ValueObjectEventType is not nullable: every session must carry an event type.
        // 'VIEW' is the state a freshly opened session starts in.
        event_type: overrides.event_type ?? 'VIEW',
        justification: overrides.justification ?? null,
        // AggregateRoot builds created_by/created_at with non-nullable value objects, so both are
        // mandatory in the DTO even though the columns themselves accept null.
        created_by: overrides.created_by ?? uuidv4(),
        created_at: overrides.created_at ?? new Date().toISOString(),
        updated_by: overrides.updated_by ?? null,
        deleted_by: overrides.deleted_by ?? null,
    });

    const formatElapsedTime = (startIso, finishIso) => {
        if (!startIso || !finishIso) return null;
        const secs = Math.floor((new Date(finishIso) - new Date(startIso)) / 1000);
        if (isNaN(secs) || secs < 0) return null;
        const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
        const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
        const ss = String(secs % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    };

    it('should create a CaseSessionDuration', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const dto = await sessionDto({ case_id: kase.id.value });
        const creator = new CaseSessionDurationCreator(repository, caseRepository);

        await creator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);
        expect(result.length).toBe(1);
    });

    it('can update an existing CaseSessionDuration with elapsed_time calculation', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const started = new Date().toISOString();
        const dto = await sessionDto({ case_id: kase.id.value, started_at: started });
        const session = CaseSessionDuration.create(dto);
        await repository.save(session);

        // Update with finished_at - elapsed_time should be calculated by Updater
        const finished = new Date(new Date(started).getTime() + 3665000).toISOString(); // +1h 1m 5s
        const updater = new CaseSessionDurationUpdater(repository);
        await updater.execute({ finished_at: finished }, session.id.value);

        const updated = await repository.find(session.id);
        const expected = formatElapsedTime(started, finished);
        expect(updated.finished_at.value).toBe(finished);
        expect(updated.elapsed_time.value).toBe(expected);
    });

    it('rejects an update whose finished_at is before started_at on a session that already has elapsed_time', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const started = new Date().toISOString();
        const firstFinish = new Date(new Date(started).getTime() + 3600000).toISOString(); // +1h
        const dto = await sessionDto({
            case_id: kase.id.value,
            started_at: started,
            finished_at: firstFinish,
            elapsed_time: formatElapsedTime(started, firstFinish),
        });
        const session = CaseSessionDuration.create(dto);
        await repository.save(session);

        // finished_at before started_at: ElapsedTimeCalculator.between() returns null for a
        // negative interval, so the Updater must reject the input instead of letting the
        // AggregateRoot compare `null` against the already-set elapsed_time and skip the setter.
        const invalidFinish = new Date(new Date(started).getTime() - 60000).toISOString(); // -1min
        const updater = new CaseSessionDurationUpdater(repository);

        await expect(updater.execute({ finished_at: invalidFinish }, session.id.value)).rejects.toThrow(
            ValidationFailError
        );

        const unchanged = await repository.find(session.id);
        expect(unchanged.finished_at.value).toBe(firstFinish);
        expect(unchanged.elapsed_time.value).toBe(formatElapsedTime(started, firstFinish));
    });

    it('should not create duplicate CaseSessionDuration', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const dto = await sessionDto({ case_id: kase.id.value });
        const creator = new CaseSessionDurationCreator(repository, caseRepository);
        await creator.execute(dto);
        await expect(creator.execute(dto)).rejects.toThrow();
    });

    it('should create a CaseSessionDuration with created_by', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const createdBy = uuidv4();
        const dto = await sessionDto({ case_id: kase.id.value, created_by: createdBy });
        const creator = new CaseSessionDurationCreator(repository, caseRepository);

        await creator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id).first();
        expect(result.created_by).toBe(createdBy);
        expect(result.created_at).toBeDefined();
    });

    it('should update CaseSessionDuration with event_type and justification', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const dto = await sessionDto({ case_id: kase.id.value });
        const session = CaseSessionDuration.create(dto);
        await repository.save(session);

        const updater = new CaseSessionDurationUpdater(repository);
        const updateDto = {
            finished_at: new Date().toISOString(),
            event_type: 'FINISHED',
            justification: 'Task completed successfully',
            updated_by: uuidv4(),
        };

        await updater.execute(updateDto, session.id.value);

        const updated = await repository.find(session.id);
        expect(updated.event_type.value).toBe('FINISHED');
        expect(updated.justification.value).toBe('Task completed successfully');
        expect(updated.finished_at.value).toBe(updateDto.finished_at);
    });

    it('should update CaseSessionDuration with PAUSED event_type', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const dto = await sessionDto({ case_id: kase.id.value });
        const session = CaseSessionDuration.create(dto);
        await repository.save(session);

        const updater = new CaseSessionDurationUpdater(repository);
        const updateDto = {
            event_type: 'PAUSED',
            justification: 'Taking a break',
            updated_by: uuidv4(),
        };

        await updater.execute(updateDto, session.id.value);

        const updated = await repository.find(session.id);
        expect(updated.event_type.value).toBe('PAUSED');
        expect(updated.justification.value).toBe('Taking a break');
    });

    it('should soft delete a CaseSessionDuration', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const dto = await sessionDto({ case_id: kase.id.value });
        const session = CaseSessionDuration.create(dto);
        await repository.save(session);

        const deleter = new CaseSessionDurationDeleter(repository);
        const deletedBy = uuidv4();
        const deletedAt = new Date().toISOString();
        const deleteDto = {
            deleted_at: deletedAt,
            deleted_by: deletedBy,
        };

        await deleter.execute(session.id.value, deleteDto);

        const deleted = await repository.find(session.id);
        expect(deleted).not.toBeNull();
        expect(deleted.deleted_at).toBeDefined();
        expect(deleted.deleted_by.value).toBe(deletedBy);
    });

    it('should calculate elapsed_time when creating with finished_at', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const started = new Date().toISOString();
        const finished = new Date(new Date(started).getTime() + 7325000).toISOString(); // +2h 2m 5s
        const dto = await sessionDto({
            case_id: kase.id.value,
            started_at: started,
            finished_at: finished,
        });
        const creator = new CaseSessionDurationCreator(repository, caseRepository);

        await creator.execute(dto);

        // Leer por find(), no con una fila cruda: es el camino que usa la aplicacion y el que
        // normaliza el `interval` de pg (#toEntity); una lectura cruda mostraria el objeto
        // PostgresInterval del driver en vez de la cadena HH:MM:SS.
        const result = await repository.find(new ValueObjectUuid('id', dto.id));
        const expected = formatElapsedTime(started, finished);
        expect(result.elapsed_time.value).toBe(expected);
    });

    it('should throw error when soft deleting non-existent CaseSessionDuration', async () => {
        const deleter = new CaseSessionDurationDeleter(repository);
        const nonExistentId = uuidv4();
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await expect(deleter.execute(nonExistentId, deleteDto)).rejects.toThrow(CustomError);
        await expect(deleter.execute(nonExistentId, deleteDto)).rejects.toThrow(
            `CaseSessionDuration with id ${nonExistentId} does not exist.`
        );
    });

    it('should use repository softDelete method directly', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const dto = await sessionDto({ case_id: kase.id.value });
        const session = CaseSessionDuration.create(dto);
        await repository.save(session);

        const deletedBy = uuidv4();
        await repository.softDelete(session.id, { value: deletedBy });

        const result = await repository
            .connection(repository.tableName)
            .select('*')
            .where('id', session.id.value)
            .first();
        expect(result.deleted_at).toBeDefined();
        expect(result.deleted_by).toBe(deletedBy);
    });

    it('should return null when no active session exists for case and user', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const userId = uuidv4();

        const finder = new CaseSessionDurationFinder(repository);
        const result = await finder.findByCaseAndUser(kase.id.value, userId);

        expect(result).toBeNull();
    });

    it('should return null when session is finished (not active)', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const userId = uuidv4();
        const started = new Date().toISOString();
        const finished = new Date(new Date(started).getTime() + 3600000).toISOString();
        const dto = await sessionDto({
            case_id: kase.id.value,
            user_id: userId,
            started_at: started,
            finished_at: finished, // finished session
        });
        const session = CaseSessionDuration.create(dto);
        await repository.save(session);

        const finder = new CaseSessionDurationFinder(repository);
        const result = await finder.findByCaseAndUser(kase.id.value, userId);

        expect(result).toBeNull();
    });

    it('should return most recent active session when multiple exist', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const userId = uuidv4();

        // Create older session
        const olderDto = await sessionDto({
            case_id: kase.id.value,
            user_id: userId,
            started_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            finished_at: null,
        });
        const olderSession = CaseSessionDuration.create(olderDto);
        await repository.save(olderSession);

        // Create newer session
        const newerDto = await sessionDto({
            case_id: kase.id.value,
            user_id: userId,
            started_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            finished_at: null,
        });
        const newerSession = CaseSessionDuration.create(newerDto);
        await repository.save(newerSession);

        const finder = new CaseSessionDurationFinder(repository);
        const result = await finder.findByCaseAndUser(kase.id.value, userId);

        expect(result).not.toBeNull();
        expect(result.toJson().data.id).toBe(newerSession.id.value);
    });

    it('should not return deleted sessions in findByCaseAndUser', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const userId = uuidv4();
        const dto = await sessionDto({
            case_id: kase.id.value,
            user_id: userId,
            finished_at: null,
        });
        const session = CaseSessionDuration.create(dto);
        await repository.save(session);

        // Soft delete the session
        const deletedBy = uuidv4();
        await repository.softDelete(session.id, { value: deletedBy });

        const finder = new CaseSessionDurationFinder(repository);
        const result = await finder.findByCaseAndUser(kase.id.value, userId);

        expect(result).toBeNull();
    });
});
