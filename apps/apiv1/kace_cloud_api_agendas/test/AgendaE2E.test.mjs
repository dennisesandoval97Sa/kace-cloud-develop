import { production as knexConfig } from '@kace/database/knexfile';
import { KnexAgendaRepository } from '@kace/core/src/agendas';
import { KnexOneScriptRepository } from '@kace/core/src/one-script';
import { AgendasMother } from '@kace/core/tests/agendas/domain/AgendasMother.js';
import OneScriptMother from '@kace/core/tests/one-script/domain/OneScriptMother.js';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

const getUpdatedPayload = (agendaPayload) => {
    const { id, created_at, created_by, ...agendaPayloadUpdated } = agendaPayload;
    return { ...agendaPayloadUpdated, description: 'Updated description' };
};

describe('Agenda E2E - Controller', () => {
    const repository = new KnexAgendaRepository(knexConfig);
    const oneScriptRepository = new KnexOneScriptRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/agenda`
            : `http://127.0.0.1:60070`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
            await oneScriptRepository.connection.destroy();
        } catch (error) {
            Helper.logError(error);
        }
    });

    it('should create an agenda', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agendaPayload = AgendasMother.dto(oneScript.id.value);

        await expect(TestHelper.postRequest(baseUrl, agendaPayload)).resolves.toHaveProperty('status', 201);
    });

    it('should not create an agenda with a script id that does not exist', async () => {
        const agendaPayload = AgendasMother.dto();
        await expect(TestHelper.postRequest(baseUrl, agendaPayload)).resolves.toHaveProperty('status', 400);
    });

    it('should not create an agenda with an invalid id', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agendaPayload = AgendasMother.dto(oneScript.id.value);

        agendaPayload.id = 'invalid';

        await expect(TestHelper.postRequest(baseUrl, agendaPayload)).resolves.toHaveProperty('status', 400);
    });

    it('should not create an agenda with an existing id', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(repository, oneScript.id.value);
        const agendaPayload = AgendasMother.dto(oneScript.id.value);

        agendaPayload.id = agenda.id.value;

        await expect(TestHelper.postRequest(baseUrl, agendaPayload)).resolves.toHaveProperty('status', 400);
    });

    it('should not create an agenda with missing fields', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agendaPayload = AgendasMother.dto(oneScript.id.value);
        delete agendaPayload.description;

        await expect(TestHelper.postRequest(baseUrl, agendaPayload)).resolves.toHaveProperty('status', 400);
    });

    it('should update an agenda', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(repository, oneScript.id.value);
        const agendaPayload = AgendasMother.dto(oneScript.id.value);

        const agendaPayloadUpdated = getUpdatedPayload(agendaPayload);

        await expect(
            TestHelper.postRequest(`${baseUrl}/${agenda.id.value}`, agendaPayloadUpdated)
        ).resolves.toHaveProperty('status', 200);
    });

    it('should not update an agenda with does not exist in database', async () => {
        const agendaPayload = AgendasMother.dto();

        const agendaPayloadUpdated = getUpdatedPayload(agendaPayload);

        await expect(
            TestHelper.postRequest(`${baseUrl}/${agendaPayload.id}`, agendaPayloadUpdated)
        ).resolves.toHaveProperty('status', 400);
    });

    it('should delete an agenda', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(repository, oneScript.id.value);

        await expect(TestHelper.getRequest(`${baseUrl}/${agenda.id.value}/delete`)).resolves.toHaveProperty(
            'status',
            200
        );
    });

    it('should not delete an agenda with does not exist in database', async () => {
        const agendaPayload = AgendasMother.dto();

        await expect(TestHelper.getRequest(`${baseUrl}/${agendaPayload.id}/delete`)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should find an agenda', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(repository, oneScript.id.value);

        await expect(TestHelper.getRequest(`${baseUrl}/${agenda.id.value}`)).resolves.toHaveProperty('status', 200);
    });

    it('should not find an agenda with non-existent id', async () => {
        const agendaPayload = AgendasMother.dto();

        await expect(TestHelper.getRequest(`${baseUrl}/${agendaPayload.id}`)).resolves.toHaveProperty('status', 404);
    });

    it('should find all agendas', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        await AgendasMother.createMany(repository, 5, oneScript.id.value);

        const response = await TestHelper.getRequest(`${baseUrl}`);
        expect(response.status).toBe(200);
        expect(response.data?.data?.items?.length ?? 0).toBeGreaterThan(0);
    });

    it('should search agendas by one script id', async () => {
        const oneScriptOne = await OneScriptMother.createOneScript(oneScriptRepository);
        const oneScriptTwo = await OneScriptMother.createOneScript(oneScriptRepository);
        await AgendasMother.createMany(repository, 5, oneScriptOne.id.value);
        await AgendasMother.createMany(repository, 5, oneScriptTwo.id.value);

        const criteriaPayload = {
            filter: [
                {
                    field: 'one_script_id',
                    operator: 'eq',
                    value: oneScriptOne.id.value,
                    type: 'AND',
                },
            ],
            limit: 10,
            offset: 0,
            order: {
                field: 'created_at',
                direction: 'asc',
            },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, criteriaPayload);

        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(5);
    });
});
