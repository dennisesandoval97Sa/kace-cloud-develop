import { production as knexConfig } from '@kace/database/knexfile';
import { KnexAgendasGroupsRepository } from '@kace/core/src/agendas-groups';
import { KnexGroupsRepository } from '@kace/core/src/grupos';
import { KnexAgendaRepository } from '@kace/core/src/agendas';
import { KnexOneScriptRepository } from '@kace/core/src/one-script';
import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository';
import { AgendasGroupsMother } from '@kace/core/tests/agendas-groups/domain/AgendasGroupsMother';
import { GroupsMother } from '@kace/core/tests/groups/domain/GroupsMother';
import { AgendasMother } from '@kace/core/tests/agendas/domain/AgendasMother.js';
import OneScriptMother from '@kace/core/tests/one-script/domain/OneScriptMother.js';
import RoleMother from '@kace/core/tests/roles/domain/RoleMother';
import { TestHelper } from '@kace/api-common';

describe('Agendas - Groups E2E - Controller', () => {
    const oneScriptRepository = new KnexOneScriptRepository(knexConfig);
    const agendaRepository = new KnexAgendaRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const agendasGroupsRepository = new KnexAgendasGroupsRepository(knexConfig);
    const roleRepository = new KnexRoleRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/agendas-groups`
            : `http://127.0.0.1:60072`;

    const setupTestData = async () => {
        const role = await RoleMother.createRandomRole(roleRepository);
        const group = await GroupsMother.createRandomGroup(groupsRepository, role.id.value);
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);

        return {
            groupId: group.id.value,
            oneScriptId: oneScript.id.value,
        };
    };

    const createAgendaGroup = async (oneScriptId, groupId) => {
        const agenda = await AgendasMother.create(agendaRepository, oneScriptId);
        await AgendasGroupsMother.create(agendasGroupsRepository, {
            agenda_id: agenda.id.value,
            group_id: groupId,
        });
        return agenda;
    };

    beforeAll(async () => {
        global.testData = await setupTestData();
    });

    afterAll(async () => {
        try {
            await agendaRepository.connection.destroy();
            await oneScriptRepository.connection.destroy();
            await groupsRepository.connection.destroy();
            await agendasGroupsRepository.connection.destroy();
            await roleRepository.connection.destroy();
        } catch (error) {
            console.error(error);
        }
    });

    it('should create an agenda group', async () => {
        const { groupId, oneScriptId } = global.testData;
        const agenda = await AgendasMother.create(agendaRepository, oneScriptId);

        const payload = {
            agenda_id: agenda.id.value,
            group_id: groupId,
        };

        await expect(TestHelper.postRequest(baseUrl, payload)).resolves.toHaveProperty('status', 201);
    });

    it('should get all agenda groups', async () => {
        const response = await TestHelper.getRequest(baseUrl);

        expect(response).toHaveProperty('status', 200);
        expect(response?.data?.data?.items?.length ?? 0).toBeGreaterThan(0);
    });

    it('should get an agenda group', async () => {
        const { groupId, oneScriptId } = global.testData;
        const agenda = await createAgendaGroup(oneScriptId, groupId);

        const response = await TestHelper.getRequest(`${baseUrl}/${agenda.id.value}`, {
            data: {
                group_id: groupId,
            },
        });

        expect(response).toHaveProperty('status', 200);
        expect(response?.data?.data?.agenda_id).toBe(agenda.id.value);
    });

    it('should search an agenda group', async () => {
        const searchPayload = {
            limit: 10,
            offset: 0,
            order: {
                field: 'created_at',
                direction: 'asc',
            },
            filter: [
                {
                    field: 'group_id',
                    operator: 'eq',
                    value: global.testData.groupId,
                    type: 'AND',
                },
            ],
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, searchPayload);

        expect(response.status).toBe(200);
    });

    it('should delete an agenda group', async () => {
        const { groupId, oneScriptId } = global.testData;
        const agenda = await createAgendaGroup(oneScriptId, groupId);

        const response = await TestHelper.getRequest(`${baseUrl}/${agenda.id.value}/delete`, {
            data: {
                group_id: groupId,
            },
        });

        expect(response).toHaveProperty('status', 200);
    });

    it('should 404 when getting an agenda group that does not exist', async () => {
        const agendasGroupsDto = AgendasGroupsMother.dto();

        const response = await TestHelper.getRequest(`${baseUrl}/${agendasGroupsDto.agenda_id}`, {
            data: {
                group_id: agendasGroupsDto.group_id,
            },
        });

        expect(response).toHaveProperty('status', 404);
    });

    it('should 400 when deleting an agenda group that does not exist', async () => {
        const agendasGroupsDto = AgendasGroupsMother.dto();

        const response = await TestHelper.getRequest(`${baseUrl}/${agendasGroupsDto.agenda_id}/delete`, {
            data: {
                group_id: agendasGroupsDto.group_id,
            },
        });

        expect(response).toHaveProperty('status', 400);
    });

    it('should create an agenda group batch', async () => {
        const { groupId, oneScriptId } = global.testData;

        const agendas = await Promise.all([
            AgendasMother.create(agendaRepository, oneScriptId),
            AgendasMother.create(agendaRepository, oneScriptId),
        ]);

        const payload = agendas.map((agenda) => ({
            agenda_id: agenda.id.value,
            group_id: groupId,
        }));

        await expect(TestHelper.postRequest(`${baseUrl}/batch`, payload)).resolves.toHaveProperty('status', 201);
    });

    it('should does not create an agenda group batch with invalid data', async () => {
        const payload = [
            {
                agenda_id: 'invalid',
                group_id: 'invalid',
            },
        ];

        await expect(TestHelper.postRequest(`${baseUrl}/batch`, payload)).resolves.toHaveProperty('status', 400);
    });

    it('should delete an agenda group batch', async () => {
        const { groupId, oneScriptId } = global.testData;

        const agendas = await Promise.all([
            createAgendaGroup(oneScriptId, groupId),
            createAgendaGroup(oneScriptId, groupId),
        ]);

        const payload = agendas.map((agenda) => ({
            agenda_id: agenda.id.value,
            group_id: groupId,
        }));

        await expect(TestHelper.postRequest(`${baseUrl}/batch/delete`, payload)).resolves.toHaveProperty('status', 200);
    });
});
