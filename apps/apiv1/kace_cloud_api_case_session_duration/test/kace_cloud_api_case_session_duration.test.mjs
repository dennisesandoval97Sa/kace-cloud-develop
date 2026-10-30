import { production as knexConfig } from '@kace/database';
import { Controller } from '../src/Controller.mjs';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { User } from '@kace/core/src/users/domain/User.js';

describe('CaseSessionDuration', () => {
	it('should return statusCode 200 for valid create', async () => {
		const event = {
			resource: '/',
			httpMethod: 'POST',
			headers: { Authorization: process.env.AWS_COGNITO_IDTOKEN },
			body: JSON.stringify({
				caseId: '11111111-1111-1111-1111-111111111111',
				startedAt: '2025-12-09T10:00:00.000Z',
			}),
		};

		const controller = new Controller(event, knexConfig);
		// inject a minimal authenticated User instance with valid UUIDs
		controller.user = new User({ id: uuidv4(), rol_id: uuidv4(), is_active: 1, created_at: '2025-12-01T00:00:00.000Z', created_by: uuidv4() });

		// stub the creator to avoid DB/case-existence checks in unit test
		controller.creator = {
			execute: async (dto) => ({ ...dto, created: true }),
		};

		const response = await controller.actionCreate();
		expect(response.statusCode).toBe(201);
	});

	it('should return statusCode 200 for POST update with id', async () => {
		const id = uuidv4();
		const event = {
			resource: '/{id}',
			httpMethod: 'POST',
			headers: { Authorization: process.env.AWS_COGNITO_IDTOKEN },
			pathParameters: { id },
			body: JSON.stringify({
				finishedAt: '2025-12-09T12:00:00.000Z',
			}),
		};

		const controller = new Controller(event, knexConfig);
		controller.user = new User({ id: uuidv4(), rol_id: uuidv4(), is_active: 1, created_at: '2025-12-01T00:00:00.000Z', created_by: uuidv4() });

		// stub repository so updater finds a session and update succeeds without DB
		const fakeSession = {
			id: { value: id },
			started_at: { value: '2025-12-09T10:00:00.000Z' },
			finished_at: { value: null },
			elapsed_time: { value: null },
			event_type: { value: null },
			justification: { value: null },
			update: function (dto) {
				if (dto.finished_at) this.finished_at = { value: dto.finished_at };
				if (dto.event_type) this.event_type = { value: dto.event_type };
				if (dto.justification) this.justification = { value: dto.justification };
			},
			flushChanges: function () {},
		};

		controller.repository = {
			find: async () => fakeSession,
			update: async () => {},
		};

		const response = await controller.actionUpdate();
		expect(response.statusCode).toBe(200);
	});

	it('should return statusCode 200 for POST update with eventType and justification', async () => {
		const id = uuidv4();
		const event = {
			resource: '/{id}',
			httpMethod: 'POST',
			headers: { Authorization: process.env.AWS_COGNITO_IDTOKEN },
			pathParameters: { id },
			body: JSON.stringify({
				finishedAt: '2025-12-09T12:00:00.000Z',
				eventType: 'FINISHED',
				justification: 'Task completed successfully',
			}),
		};

		const controller = new Controller(event, knexConfig);
		controller.user = new User({ id: uuidv4(), rol_id: uuidv4(), is_active: 1, created_at: '2025-12-01T00:00:00.000Z', created_by: uuidv4() });

		// stub repository so updater finds a session and update succeeds without DB
		const fakeSession = {
			id: { value: id },
			started_at: { value: '2025-12-09T10:00:00.000Z' },
			finished_at: { value: null },
			elapsed_time: { value: null },
			event_type: { value: null },
			justification: { value: null },
			update: function (dto) {
				if (dto.finished_at) this.finished_at = { value: dto.finished_at };
				if (dto.event_type) this.event_type = { value: dto.event_type };
				if (dto.justification) this.justification = { value: dto.justification };
			},
			flushChanges: function () {},
		};

		controller.repository = {
			find: async () => fakeSession,
			update: async () => {},
		};

		const response = await controller.actionUpdate();
		expect(response.statusCode).toBe(200);
		expect(fakeSession.event_type.value).toBe('FINISHED');
		expect(fakeSession.justification.value).toBe('Task completed successfully');
	});

	it('should return statusCode 200 for POST update with PAUSED eventType', async () => {
		const id = uuidv4();
		const event = {
			resource: '/{id}',
			httpMethod: 'POST',
			headers: { Authorization: process.env.AWS_COGNITO_IDTOKEN },
			pathParameters: { id },
			body: JSON.stringify({
				eventType: 'PAUSED',
				justification: 'Taking a break',
			}),
		};

		const controller = new Controller(event, knexConfig);
		controller.user = new User({ id: uuidv4(), rol_id: uuidv4(), is_active: 1, created_at: '2025-12-01T00:00:00.000Z', created_by: uuidv4() });

		// stub repository so updater finds a session and update succeeds without DB
		const fakeSession = {
			id: { value: id },
			started_at: { value: '2025-12-09T10:00:00.000Z' },
			finished_at: { value: null },
			elapsed_time: { value: null },
			event_type: { value: null },
			justification: { value: null },
			update: function (dto) {
				if (dto.finished_at) this.finished_at = { value: dto.finished_at };
				if (dto.event_type) this.event_type = { value: dto.event_type };
				if (dto.justification) this.justification = { value: dto.justification };
			},
			flushChanges: function () {},
		};

		controller.repository = {
			find: async () => fakeSession,
			update: async () => {},
		};

		const response = await controller.actionUpdate();
		expect(response.statusCode).toBe(200);
		expect(fakeSession.event_type.value).toBe('PAUSED');
		expect(fakeSession.justification.value).toBe('Taking a break');
	});

	it('should return statusCode 400 for invalid eventType', async () => {
		const id = uuidv4();
		const event = {
			resource: '/{id}',
			httpMethod: 'POST',
			headers: { Authorization: process.env.AWS_COGNITO_IDTOKEN },
			pathParameters: { id },
			body: JSON.stringify({
				eventType: 'INVALID_TYPE',
				justification: 'Test',
			}),
		};

		const controller = new Controller(event, knexConfig);
		controller.user = new User({ id: uuidv4(), rol_id: uuidv4(), is_active: 1, created_at: '2025-12-01T00:00:00.000Z', created_by: uuidv4() });

		const response = await controller.actionUpdate();
		expect(response.statusCode).toBe(400);
	});

	it('should return statusCode 200 for soft delete', async () => {
		const id = uuidv4();
		const userId = uuidv4();
		const event = {
			resource: '/{id}',
			httpMethod: 'DELETE',
			headers: { Authorization: process.env.AWS_COGNITO_IDTOKEN },
			pathParameters: { id },
		};

		const controller = new Controller(event, knexConfig);
		controller.user = new User({ id: userId, rol_id: uuidv4(), is_active: 1, created_at: '2025-12-01T00:00:00.000Z', created_by: uuidv4() });

		// stub repository
		const fakeSession = {
			id: { value: id },
			started_at: { value: '2025-12-09T10:00:00.000Z' },
		};

		controller.repository = {
			find: async () => fakeSession,
			softDelete: async (sessionId, deletedBy) => {
				expect(sessionId.value).toBe(id);
				expect(deletedBy.value).toBe(userId);
			},
		};

		const response = await controller.actionDelete();
		expect(response.statusCode).toBe(200);
	});

	it('should return statusCode 404 when soft deleting non-existent session', async () => {
		const id = uuidv4();
		const event = {
			resource: '/{id}',
			httpMethod: 'DELETE',
			headers: { Authorization: process.env.AWS_COGNITO_IDTOKEN },
			pathParameters: { id },
		};

		const controller = new Controller(event, knexConfig);
		controller.user = new User({ id: uuidv4(), rol_id: uuidv4(), is_active: 1, created_at: '2025-12-01T00:00:00.000Z', created_by: uuidv4() });

		// stub repository to return null (not found)
		controller.repository = {
			find: async () => null,
		};

		const response = await controller.actionDelete();
		expect(response.statusCode).toBe(404);
	});

	it('should return statusCode 400 for invalid id in delete', async () => {
		const event = {
			resource: '/{id}',
			httpMethod: 'DELETE',
			headers: { Authorization: process.env.AWS_COGNITO_IDTOKEN },
			pathParameters: { id: 'invalid-uuid' },
		};

		const controller = new Controller(event, knexConfig);
		controller.user = new User({ id: uuidv4(), rol_id: uuidv4(), is_active: 1, created_at: '2025-12-01T00:00:00.000Z', created_by: uuidv4() });

		const response = await controller.actionDelete();
		expect(response.statusCode).toBe(400);
	});
});
