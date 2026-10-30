import { production as knexConfig } from '@kace/database/knexfile';
import { afterAll, describe, expect, it } from '@jest/globals';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import { GroupsMother } from '@kace/core/tests/groups/domain/GroupsMother.js';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { KnexShiftManagementRepository } from '@kace/core/src/shift-management/index.js';
import { KnexPoliciesRepository } from '@kace/core/src/policies/infrastructure/persistence/KnexPoliciesRepository.js';
import { GroupFactory } from '@kace/core/src/factories/GroupFactory.js';
import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository.js';
import { PoliciesMother } from '@kace/core/tests/policies/domain/PoliciesMother.js';
import RoleMother from '@kace/core/tests/roles/domain/RoleMother.js';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared';
import { GROUP_SCHEDULE_UNAVAILABLE } from '@kace/error-codes';

describe('GroupsE2E test', () => {
    const repository = new KnexGroupsRepository(knexConfig);
    const repositoryShiftManagement = new KnexShiftManagementRepository(knexConfig);
    const roleRpository = new KnexRoleRepository(knexConfig);
    const politicRepository = new KnexPoliciesRepository(knexConfig);
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/groups`
            : 'http://localhost:60028';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a Group', async () => {
        const payload = await new GroupFactory(knexConfig).generateAttributes();
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
        expect(response.data.data.id).toBeDefined();
        expect(response.data.data.id).not.toBe(payload.id);
    });

    it('return statusCode 400 when validation fails to create a Group', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a Group', async () => {
        const politic = await PoliciesMother.createPolicy(politicRepository);
        const { id: rol_id } = await RoleMother.createRole(roleRpository, {
            policy_id: politic.id.value,
        });
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement, rol_id.value);

        const dataExpected = {
            id: group.id.value,
            nombre: group.nombre.value,
            status: group.status.value,
            horario_id: group.horario_id.value,
            descripcion: group.descripcion.value,
            codigo_externo: group.codigo_externo.value,
            codigos_externos: group.codigos_externos.value,
            permisos: group.permisos.value,
            layouts: group.layouts.value,
            comportamientos: group.comportamientos.value,
            filter_order: group.filter_order.value,
            created_by: group.created_by.value,
            created_at: group.created_at.value,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${group.id.value}`);

        const data = response.data.data.data;

        expect(response.status).toBe(200);
        expect(data).toMatchObject(dataExpected);
        expect(data.horario_description).toBeDefined();
        expect(response.data.data.horario_description).toBe(data.horario_description);
    });

    it('should fetch all Groups', async () => {
        const politic = await PoliciesMother.createPolicy(politicRepository);
        const { id: rol_id } = await RoleMother.createRole(roleRpository, {
            policy_id: politic.id.value,
        });
        const group = await GroupsMother.createRandomGroup(repository, rol_id.value);
        const group2 = await GroupsMother.createRandomGroup(repository, rol_id.value);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(group2.id.value);
        expect(response.data.data.items[1].id).toEqual(group.id.value);
    });

    it('should delete a Group', async () => {
        const politic = await PoliciesMother.createPolicy(politicRepository);
        const { id: rol_id } = await RoleMother.createRole(roleRpository, {
            policy_id: politic.id.value,
        });
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement, rol_id.value);

        const response = await TestHelper.getRequest(`${baseUrl}/${group.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a Group', async () => {
        const politic = await PoliciesMother.createPolicy(politicRepository);
        const { id: rol_id } = await RoleMother.createRole(roleRpository, {
            policy_id: politic.id.value,
        });
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement, rol_id.value);

        const uniqueUpdatedName = `nombre actualizado ${group.id.value.replace(/[^a-zA-Z\s]/g, '')}`;
        const payload = {
            nombre: uniqueUpdatedName,
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${group.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('rejects updating a Group with a horario_id that does not exist', async () => {
        const politic = await PoliciesMother.createPolicy(politicRepository);
        const { id: rol_id } = await RoleMother.createRole(roleRpository, {
            policy_id: politic.id.value,
        });
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement, rol_id.value);

        const response = await TestHelper.postRequest(`${baseUrl}/${group.id.value}`, { horario_id: uuidv4() });

        expect(response).toHaveProperty('response.status', 400);
        expect(response.response.data.data.code).toBe(GROUP_SCHEDULE_UNAVAILABLE);
    });

    it('rejects creating a Group with a deleted schedule', async () => {
        const payload = await new GroupFactory(knexConfig).generateAttributes();
        await repositoryShiftManagement
            .connection('shift_management')
            .where({ id: payload.horario_id })
            .update({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response).toHaveProperty('response.status', 400);
        expect(response.response.data.data.code).toBe(GROUP_SCHEDULE_UNAVAILABLE);
    });

    it('should return 404 when fetch a group that is deleted', async () => {
        const politic = await PoliciesMother.createPolicy(politicRepository);
        const { id: rol_id } = await RoleMother.createRole(roleRpository, {
            policy_id: politic.id.value,
        });
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement, rol_id.value);

        await TestHelper.getRequest(`${baseUrl}/${group.id.value}/delete`);

        const response = await TestHelper.getRequest(`${baseUrl}/${group.id.value}`);

        expect(response).toHaveProperty('response.status', 404);
    });

    it('should return 404 when fetch a Group that not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response).toHaveProperty('response.status', 404);
    });

    it('should return a empty object when delete a Group that is deleted', async () => {
        const politic = await PoliciesMother.createPolicy(politicRepository);
        const { id: rol_id } = await RoleMother.createRole(roleRpository, {
            policy_id: politic.id.value,
        });
        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement, rol_id.value);

        await TestHelper.getRequest(`${baseUrl}/${group.id.value}/delete`);
        const response = await TestHelper.getRequest(`${baseUrl}/${group.id.value}/delete`);
        await expect(response).toHaveProperty('response.status', 500);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
