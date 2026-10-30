import {
    KnexUserGroupRelationshipRepository,
    UserGroupBatchCreator,
    UserGroupBatchDeleter,
} from '../../src/user-group-relationships';
import { UserGroupRelationship } from '../../src/user-group-relationships/domain/UserGroupRelationship';
import UserGroupRelationshipMother from './domain/UserGroupRelationshipMother';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';

const HISTORY_TABLE = 'history_rel_usuarios_grupos';

const parseAttrs = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

describe('UserGroup History Integration Tests', () => {
    const repository = new KnexUserGroupRelationshipRepository(knexConfig);
    const idsValidator = {
        validateUserIds: () => true,
        validateGroupIds: () => true,
        validateRelation: () => true,
    };
    const batchCreator = new UserGroupBatchCreator(repository, idsValidator);
    const batchDeleter = new UserGroupBatchDeleter(repository, idsValidator);

    it('records a creation history row via saveCreationHistory', async () => {
        const dto = UserGroupRelationshipMother.dto();
        const actorId = uuidv4();
        const createdAt = new Date().toISOString();
        const userGroup = UserGroupRelationship.create(dto);

        await repository.saveCreationHistory(userGroup, actorId, createdAt);

        const rows = await repository.connection(HISTORY_TABLE).select('*');
        expect(rows.length).toBe(1);
        expect(rows[0].entity_id).toBe(dto.grupo_id);
        expect(rows[0].created_by).toBe(actorId);
        expect(parseAttrs(rows[0].new_attributes)).toEqual({ usuario_id: dto.usuario_id, grupo_id: dto.grupo_id });
        expect(parseAttrs(rows[0].changed_attributes)).toEqual({ usuario_id: dto.usuario_id, grupo_id: dto.grupo_id });
        expect(parseAttrs(rows[0].original_attributes)).toEqual({});
    });

    it('records a deletion history row via saveDeletionHistory', async () => {
        const dto = UserGroupRelationshipMother.dto();
        const actorId = uuidv4();
        const createdAt = new Date().toISOString();
        const userGroup = UserGroupRelationship.create(dto);

        await repository.saveDeletionHistory(userGroup, actorId, createdAt);

        const rows = await repository.connection(HISTORY_TABLE).select('*');
        expect(rows.length).toBe(1);
        expect(rows[0].entity_id).toBe(dto.grupo_id);
        expect(rows[0].created_by).toBe(actorId);
        expect(parseAttrs(rows[0].original_attributes)).toEqual({ usuario_id: dto.usuario_id, grupo_id: dto.grupo_id });
        expect(parseAttrs(rows[0].new_attributes)).toEqual({});
        expect(parseAttrs(rows[0].changed_attributes)).toEqual({});
    });

    it('writes one creation history row per relationship with a single created_at per block', async () => {
        const groupId = uuidv4();
        const actorId = uuidv4();
        const relationships = [];
        for (let i = 0; i < 3; i++) {
            const dto = { usuario_id: uuidv4(), grupo_id: groupId };
            // Los ids nacen en este `it`, no en la factoria: hay que respaldar
            // el usuario y el grupo o el lote cae por clave foranea.
            await UserGroupRelationshipMother.ensureRelations(repository.connection, dto);
            relationships.push(dto);
        }

        await batchCreator.execute(relationships, actorId);

        const rows = await repository.connection(HISTORY_TABLE).select('*');
        expect(rows.length).toBe(3);

        const timestamps = new Set(rows.map((row) => new Date(row.created_at).toISOString()));
        expect(timestamps.size).toBe(1);

        rows.forEach((row) => {
            expect(row.entity_id).toBe(groupId);
            expect(row.created_by).toBe(actorId);
            expect(parseAttrs(row.original_attributes)).toEqual({});
        });
    });

    it('does not leave creation history rows when the batch rolls back', async () => {
        const existing = await UserGroupRelationshipMother.create(repository);
        const actorId = uuidv4();
        const dto = [{ usuario_id: existing.usuario_id.value, grupo_id: existing.grupo_id.value }];

        await expect(batchCreator.execute(dto, actorId)).rejects.toThrow(
            'Batch creation failed, transaction rolled back.'
        );

        const rows = await repository.connection(HISTORY_TABLE).select('*');
        expect(rows.length).toBe(0);
    });

    it('writes one deletion history row per relationship with a single created_at per block', async () => {
        const groupId = uuidv4();
        const actorId = uuidv4();
        const relationships = [];
        for (let i = 0; i < 3; i++) {
            const dto = { usuario_id: uuidv4(), grupo_id: groupId };
            relationships.push(dto);
            await UserGroupRelationshipMother.create(repository, dto);
        }

        await batchDeleter.execute(relationships, actorId);

        const rows = await repository.connection(HISTORY_TABLE).select('*');
        expect(rows.length).toBe(3);

        const timestamps = new Set(rows.map((row) => new Date(row.created_at).toISOString()));
        expect(timestamps.size).toBe(1);

        rows.forEach((row) => {
            expect(row.entity_id).toBe(groupId);
            expect(row.created_by).toBe(actorId);
            expect(parseAttrs(row.new_attributes)).toEqual({});
        });
    });

    it('does not leave deletion history rows when the batch rolls back', async () => {
        const actorId = uuidv4();
        const relationships = [];
        for (let i = 0; i < 3; i++) {
            const dto = UserGroupRelationshipMother.dto();
            await UserGroupRelationshipMother.create(repository, dto);
            relationships.push(dto);
        }
        delete relationships[2].grupo_id;

        await expect(batchDeleter.execute(relationships, actorId)).rejects.toThrow(
            'Batch deletion failed, transaction rolled back.'
        );

        const rows = await repository.connection(HISTORY_TABLE).select('*');
        expect(rows.length).toBe(0);
    });

    it('throws and records nothing when batchCreator is called without an actor', async () => {
        const relationships = [{ usuario_id: uuidv4(), grupo_id: uuidv4() }];

        await expect(batchCreator.execute(relationships)).rejects.toThrow(
            'actorId is required to record user-group relationship history.'
        );

        const rows = await repository.connection(HISTORY_TABLE).select('*');
        expect(rows.length).toBe(0);
    });

    it('throws and records nothing when batchDeleter is called without an actor', async () => {
        const dto = UserGroupRelationshipMother.dto();
        await UserGroupRelationshipMother.create(repository, dto);

        await expect(batchDeleter.execute([dto])).rejects.toThrow(
            'actorId is required to record user-group relationship history.'
        );

        const rows = await repository.connection(HISTORY_TABLE).select('*');
        expect(rows.length).toBe(0);
    });
});
