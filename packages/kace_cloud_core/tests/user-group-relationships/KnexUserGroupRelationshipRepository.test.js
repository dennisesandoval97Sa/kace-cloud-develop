import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexUserGroupRelationshipRepository } from '../../src/user-group-relationships/infrastructure/persistence/KnexUserGroupRelationshipRepository.js';
import { UserGroupRelationship } from '../../src/user-group-relationships/domain/UserGroupRelationship.js';
import { Criteria } from '../../src/shared/criteria/Criteria.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';

describe('KnexUserGroupRelationshipRepository Active and Non-Deleted Filtering Tests', () => {
    const repository = new KnexUserGroupRelationshipRepository(knexConfig);
    const db = repository.connection;

    beforeEach(async () => {
        await db(repository.tableName).delete();
    });

    afterAll(async () => {
        await repository.destroyConnection();
    });

    const createGroup = async (overrides = {}) => {
        const id = uuidv4();
        await db('grupos').insert({
            id,
            nombre: `Group-${id.slice(0, 8)}`,
            status: StatusEnum.ACTIVE.value,
            deleted_at: null,
            ...overrides,
        });
        return id;
    };

    const createUser = async (overrides = {}) => {
        const id = uuidv4();
        await db('usuarios').insert({
            id,
            nombres: 'Test',
            apellido1: 'User',
            login: `user_${id.slice(0, 8)}`,
            email: `${id.slice(0, 8)}@test.com`,
            is_active: String(StatusEnum.ACTIVE.value),
            deleted_at: null,
            ...overrides,
        });
        return id;
    };

    const createRelation = async (usuario_id, grupo_id) => {
        const rel = UserGroupRelationship.create({ usuario_id, grupo_id });
        await repository.save(rel);
        return rel;
    };

    it('should return relations when both user and group are active and not deleted', async () => {
        const groupId = await createGroup({ status: StatusEnum.ACTIVE.value, deleted_at: null });
        const userId = await createUser({ is_active: '1', deleted_at: null });
        await createRelation(userId, groupId);

        const criteria = new Criteria([], null, 10, 0, undefined, repository.tableName);
        const results = await repository.search(criteria);

        expect(results.length).toBe(1);
        expect(results[0].usuario_id.value).toBe(userId);
        expect(results[0].grupo_id.value).toBe(groupId);
    });

    it('should exclude relations where the group is soft-deleted', async () => {
        const groupId = await createGroup({ status: StatusEnum.ACTIVE.value, deleted_at: new Date() });
        const userId = await createUser({ is_active: '1', deleted_at: null });
        await createRelation(userId, groupId);

        const criteria = new Criteria([], null, 10, 0, undefined, repository.tableName);
        const results = await repository.search(criteria);

        expect(results.length).toBe(0);

        const countResult = await repository.count(criteria);
        expect(Number(countResult.count)).toBe(0);
    });

    it('should include relations where the group is inactive (status = 2) for administration views', async () => {
        const groupId = await createGroup({ status: StatusEnum.INACTIVE.value, deleted_at: null });
        const userId = await createUser({ is_active: '1', deleted_at: null });
        await createRelation(userId, groupId);

        const criteria = new Criteria([], null, 10, 0, undefined, repository.tableName);
        const results = await repository.search(criteria);

        expect(results.length).toBe(1);
        expect(results[0].usuario_id.value).toBe(userId);
        expect(results[0].grupo_id.value).toBe(groupId);

        const countResult = await repository.count(criteria);
        expect(Number(countResult.count)).toBe(1);
    });

    it('should exclude relations where the user is soft-deleted', async () => {
        const groupId = await createGroup({ status: StatusEnum.ACTIVE.value, deleted_at: null });
        const userId = await createUser({ is_active: '1', deleted_at: new Date() });
        await createRelation(userId, groupId);

        const criteria = new Criteria([], null, 10, 0, undefined, repository.tableName);
        const results = await repository.search(criteria);

        expect(results.length).toBe(0);

        const countResult = await repository.count(criteria);
        expect(Number(countResult.count)).toBe(0);
    });

    it('should include relations where the user is inactive for administration views', async () => {
        const groupId = await createGroup({ status: StatusEnum.ACTIVE.value, deleted_at: null });
        const userId = await createUser({ is_active: String(StatusEnum.INACTIVE.value), deleted_at: null });
        await createRelation(userId, groupId);

        const criteria = new Criteria([], null, 10, 0, undefined, repository.tableName);
        const results = await repository.search(criteria);

        expect(results.length).toBe(1);
        expect(results[0].usuario_id.value).toBe(userId);
        expect(results[0].grupo_id.value).toBe(groupId);

        const countResult = await repository.count(criteria);
        expect(Number(countResult.count)).toBe(1);
    });
});
