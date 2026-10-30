import { KnexCaseSessionDurationRepository } from '@kace/core/src/case_session_durations/infraestructure/KnexCaseSessionDurationRepository.js';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import CaseSessionDurationMother from '@kace/core/tests/case_session_durations/domain/CaseSessionDurationMother.js';
import CasesMother from '@kace/core/tests/case/domain/CasesMother.js';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';

describe('CaseSessionDurationController E2E', () => {
	const repository = new KnexCaseSessionDurationRepository(knexConfig);
	const caseRepository = new KnexCaseRepository(knexConfig);

	const baseUrl =
		process.env.APPS_ENVIRONMENT === 'staging'
			? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/case-session-durations`
			: 'http://127.0.0.1:60019';

	afterAll(async () => {
		try {
			repository.connection.destroy();
		} catch (error) {
			Helper.logInfo(error);
		}
	});

	it('should create a CaseSessionDuration', async () => {
		const payload = CaseSessionDurationMother.dto();
		// ensure referenced case exists so creator validation passes
		await CasesMother.createCase(caseRepository, { id: payload.case_id });
		const apiPayload = {
			id: payload.id,
			caseId: payload.case_id,
			startedAt: payload.started_at,
		};

		const response = await TestHelper.postRequest(baseUrl, apiPayload);
		expect([200, 201]).toContain(response.status);
	});

	it('return statusCode 400 when validation fails to create a CaseSessionDuration', async () => {
		const payload = {};

		const response = await TestHelper.postRequest(baseUrl, payload);
		expect(response).toHaveProperty('status', 400);
	});


	it('should update a CaseSessionDuration', async () => {
		const dto = CaseSessionDurationMother.dto();
		await CasesMother.createCase(caseRepository, { id: dto.case_id });
		const session = await CaseSessionDurationMother.create(repository, dto);
		const payload = { finishedAt: new Date().toISOString() };

		const response = await TestHelper.postRequest(`${baseUrl}/${session.id.value}`, payload);
		expect(response.status).toBe(200);
	});

	it('should update a CaseSessionDuration with eventType and justification', async () => {
		const dto = CaseSessionDurationMother.dto();
		await CasesMother.createCase(caseRepository, { id: dto.case_id });
		const session = await CaseSessionDurationMother.create(repository, dto);
		const payload = {
			finishedAt: new Date().toISOString(),
			eventType: 'FINISHED',
			justification: 'Test justification for completion',
		};

		const response = await TestHelper.postRequest(`${baseUrl}/${session.id.value}`, payload);
		expect(response.status).toBe(200);
		expect(response.data).toHaveProperty('event_type', 'FINISHED');
		expect(response.data).toHaveProperty('justification', 'Test justification for completion');
	});

	it('should update a CaseSessionDuration with PAUSED eventType', async () => {
		const dto = CaseSessionDurationMother.dto();
		await CasesMother.createCase(caseRepository, { id: dto.case_id });
		const session = await CaseSessionDurationMother.create(repository, dto);
		const payload = {
			eventType: 'PAUSED',
			justification: 'Taking a break',
		};

		const response = await TestHelper.postRequest(`${baseUrl}/${session.id.value}`, payload);
		expect(response.status).toBe(200);
	});

	it('should soft delete a CaseSessionDuration', async () => {
		const dto = CaseSessionDurationMother.dto();
		await CasesMother.createCase(caseRepository, { id: dto.case_id });
		const session = await CaseSessionDurationMother.create(repository, dto);

		const response = await TestHelper.deleteRequest(`${baseUrl}/${session.id.value}`);
		expect(response.status).toBe(200);
		expect(response.data).toHaveProperty('message', 'CaseSessionDuration deleted successfully');

		// Verify the record is soft deleted
		const deletedSession = await repository.find(session.id);
		expect(deletedSession).not.toBeNull();
		expect(deletedSession.deleted_at).toBeDefined();
		expect(deletedSession.deleted_at).not.toBeNull();
	});

	it('should return 404 when trying to delete a non-existent CaseSessionDuration', async () => {
		const nonExistentId = '00000000-0000-0000-0000-000000000000';
		const response = await TestHelper.deleteRequest(`${baseUrl}/${nonExistentId}`);
		expect(response.status).toBe(404);
		expect(response.data).toHaveProperty('message', 'CaseSessionDuration not found');
	});

});
