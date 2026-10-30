import { production as knexConfig } from '@kace/database/knexfile';
import { KnexAgendaRepository } from '@kace/core/src/agendas';
import { KnexOneScriptRepository } from '@kace/core/src/one-script';
import { KnexAppointmentTimeSlotsRepository } from '@kace/core/src/appointment-time-slots';
import { AppointmentTimeSlotsMother } from '@kace/core/tests/appointment-time-slots/domain/AppointmentTimeSlotsMother';
import { AgendasMother } from '@kace/core/tests/agendas/domain/AgendasMother.js';
import OneScriptMother from '@kace/core/tests/one-script/domain/OneScriptMother.js';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

const getUpdatedPayload = (appointmentTimeSlotsPayload) => {
    const { id, created_at, created_by, ...appointmentTimeSlotsPayloadUpdated } = appointmentTimeSlotsPayload;
    return {
        ...appointmentTimeSlotsPayloadUpdated,
        description: 'Updated description',
    };
};

describe('AppointmentTimeSlots E2E - Controller', () => {
    const agendaRepository = new KnexAgendaRepository(knexConfig);
    const oneScriptRepository = new KnexOneScriptRepository(knexConfig);
    const appointmentTimeSlotsRepository = new KnexAppointmentTimeSlotsRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/agenda`
            : `http://127.0.0.1:60074`;

    const setupTestData = async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(agendaRepository, oneScript.id.value);

        return {
            agendaId: agenda.id.value,
        };
    };

    afterEach(async () => {
        await appointmentTimeSlotsRepository.connection(appointmentTimeSlotsRepository.tableName).delete();
    });

    beforeAll(async () => {
        global.testData = await setupTestData();
    });

    afterAll(async () => {
        try {
            await agendaRepository.connection.destroy();
            await oneScriptRepository.connection.destroy();
            await appointmentTimeSlotsRepository.connection.destroy();
        } catch (error) {
            Helper.logError(error);
        }
    });

    it('should not create an appointment time slot when identical time slot exists', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);

        await TestHelper.postRequest(baseUrl, appointmentTimeSlotPayload);

        await expect(TestHelper.postRequest(baseUrl, appointmentTimeSlotPayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should not create an appointment time slot when overlapping at the start', async () => {
        const { agendaId } = global.testData;

        const existingTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        existingTimeSlotPayload.start_time = '08:00';
        existingTimeSlotPayload.end_time = '09:00';
        await TestHelper.postRequest(baseUrl, existingTimeSlotPayload);

        const overlappingTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        overlappingTimeSlotPayload.start_time = '07:30';
        overlappingTimeSlotPayload.end_time = '08:30';

        await expect(TestHelper.postRequest(baseUrl, overlappingTimeSlotPayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should not create an appointment time slot when overlapping at the end', async () => {
        const { agendaId } = global.testData;

        const existingTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        existingTimeSlotPayload.start_time = '08:00';
        existingTimeSlotPayload.end_time = '09:00';
        await TestHelper.postRequest(baseUrl, existingTimeSlotPayload);

        const overlappingTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        overlappingTimeSlotPayload.start_time = '08:30';
        overlappingTimeSlotPayload.end_time = '09:30';

        await expect(TestHelper.postRequest(baseUrl, overlappingTimeSlotPayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should not create an appointment time slot when overlapping entirely', async () => {
        const { agendaId } = global.testData;

        const existingTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        existingTimeSlotPayload.start_time = '08:00';
        existingTimeSlotPayload.end_time = '09:00';
        await TestHelper.postRequest(baseUrl, existingTimeSlotPayload);

        const overlappingTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        overlappingTimeSlotPayload.start_time = '07:00';
        overlappingTimeSlotPayload.end_time = '10:00';

        await expect(TestHelper.postRequest(baseUrl, overlappingTimeSlotPayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should not create an appointment time slot when it is entirely contained in an existing one', async () => {
        const { agendaId } = global.testData;

        const existingTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        existingTimeSlotPayload.start_time = '08:00';
        existingTimeSlotPayload.end_time = '09:00';
        await TestHelper.postRequest(baseUrl, existingTimeSlotPayload);

        const overlappingTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        overlappingTimeSlotPayload.start_time = '08:15';
        overlappingTimeSlotPayload.end_time = '08:45';

        await expect(TestHelper.postRequest(baseUrl, overlappingTimeSlotPayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should create an appointment time slot when adjacent but not overlapping', async () => {
        const { agendaId } = global.testData;

        const existingTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        existingTimeSlotPayload.start_time = '08:00';
        existingTimeSlotPayload.end_time = '09:00';
        await TestHelper.postRequest(baseUrl, existingTimeSlotPayload);

        const adjacentTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        adjacentTimeSlotPayload.start_time = '09:00';
        adjacentTimeSlotPayload.end_time = '10:00';

        await expect(TestHelper.postRequest(baseUrl, adjacentTimeSlotPayload)).resolves.toHaveProperty('status', 201);
    });

    it('should create an appointment time slot', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);

        await expect(TestHelper.postRequest(baseUrl, appointmentTimeSlotPayload)).resolves.toHaveProperty(
            'status',
            201
        );
    });

    it('should not create an appointment time slot when the agenda does not exist', async () => {
        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto();

        await expect(TestHelper.postRequest(baseUrl, appointmentTimeSlotPayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should not create an appointment time slot when start time is greater than end time', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        appointmentTimeSlotPayload.start_time = '11:00';
        appointmentTimeSlotPayload.end_time = '10:00';

        await expect(TestHelper.postRequest(baseUrl, appointmentTimeSlotPayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should not create an appointment time slot with missing fields', async () => {
        const { agendaId } = global.testData;
        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        delete appointmentTimeSlotPayload.description;

        await expect(TestHelper.postRequest(baseUrl, appointmentTimeSlotPayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should update an appointment time slot', async () => {
        const { agendaId } = global.testData;
        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);
        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);

        const appointmentTimeSlotPayloadUpdated = getUpdatedPayload(appointmentTimeSlotPayload);

        await expect(
            TestHelper.postRequest(`${baseUrl}/${appointmentTimeSlot.id.value}`, appointmentTimeSlotPayloadUpdated)
        ).resolves.toHaveProperty('status', 200);
    });

    it('should not update an appointment time slot when it overlaps with another', async () => {
        const { agendaId } = global.testData;

        const existingSlot1Payload = AppointmentTimeSlotsMother.dto(agendaId);
        existingSlot1Payload.start_time = '08:00';
        existingSlot1Payload.end_time = '09:00';
        const existingSlot1Response = await TestHelper.postRequest(baseUrl, existingSlot1Payload);
        expect(existingSlot1Response.status).toBe(201);

        const existingSlot2Payload = AppointmentTimeSlotsMother.dto(agendaId);
        existingSlot2Payload.start_time = '09:00';
        existingSlot2Payload.end_time = '10:00';
        const existingSlot2Response = await TestHelper.postRequest(baseUrl, existingSlot2Payload);
        expect(existingSlot2Response.status).toBe(201);

        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        const appointmentTimeSlotPayloadUpdated = getUpdatedPayload(appointmentTimeSlotPayload);

        const updatePayload = {
            ...appointmentTimeSlotPayloadUpdated,
            start_time: '08:30',
            end_time: '09:30',
        };

        await expect(
            TestHelper.postRequest(`${baseUrl}/${existingSlot1Payload.id}`, updatePayload)
        ).resolves.toHaveProperty('status', 400);
    });

    it('should not update an appointment time slot when the appointment time slot does not exist', async () => {
        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto();

        const appointmentTimeSlotPayloadUpdated = getUpdatedPayload(appointmentTimeSlotPayload);

        await expect(
            TestHelper.postRequest(`${baseUrl}/${appointmentTimeSlotPayload.id}`, appointmentTimeSlotPayloadUpdated)
        ).resolves.toHaveProperty('status', 400);
    });

    it('should not update an appointment time slot when start time is greater than end time', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);
        const appointmentTimeSlotPayloadUpdated = getUpdatedPayload(appointmentTimeSlotPayload);

        appointmentTimeSlotPayloadUpdated.start_time = '11:00';
        appointmentTimeSlotPayloadUpdated.end_time = '10:00';

        await expect(
            TestHelper.postRequest(`${baseUrl}/${appointmentTimeSlot.id.value}`, appointmentTimeSlotPayloadUpdated)
        ).resolves.toHaveProperty('status', 400);
    });

    it('should not update an appointment time slot with missing fields', async () => {
        const { agendaId } = global.testData;
        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto(agendaId);
        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);
        const appointmentTimeSlotPayloadUpdated = getUpdatedPayload(appointmentTimeSlotPayload);

        delete appointmentTimeSlotPayloadUpdated.description;

        await expect(
            TestHelper.postRequest(`${baseUrl}/${appointmentTimeSlot.id.value}`, appointmentTimeSlotPayloadUpdated)
        ).resolves.toHaveProperty('status', 400);
    });

    it('should delete an appointment time slot', async () => {
        const { agendaId } = global.testData;
        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        await expect(
            TestHelper.getRequest(`${baseUrl}/${appointmentTimeSlot.id.value}/delete`)
        ).resolves.toHaveProperty('status', 200);
    });

    it('should not delete an appointment time slot with does not exist in database', async () => {
        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto();

        await expect(
            TestHelper.getRequest(`${baseUrl}/${appointmentTimeSlotPayload.id}/delete`)
        ).resolves.toHaveProperty('status', 400);
    });

    it('should find an appointment time slot', async () => {
        const { agendaId } = global.testData;
        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        await expect(TestHelper.getRequest(`${baseUrl}/${appointmentTimeSlot.id.value}`)).resolves.toHaveProperty(
            'status',
            200
        );
    });

    it('should not find an appointment time slot with non-existent id', async () => {
        const appointmentTimeSlotPayload = AppointmentTimeSlotsMother.dto();

        await expect(TestHelper.getRequest(`${baseUrl}/${appointmentTimeSlotPayload.id}`)).resolves.toHaveProperty(
            'status',
            404
        );
    });

    it('should find all appointment time slots', async () => {
        const { agendaId } = global.testData;
        await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        const response = await TestHelper.getRequest(`${baseUrl}`);
        expect(response.status).toBe(200);
        expect(response.data?.data?.items?.length ?? 0).toBeGreaterThan(0);
    });

    it('should search appointment time slots by agenda id', async () => {
        const { agendaId } = global.testData;
        await AppointmentTimeSlotsMother.createMany(appointmentTimeSlotsRepository, 5, agendaId);

        const criteriaPayload = {
            filter: [
                {
                    field: 'agenda_id',
                    operator: 'eq',
                    value: agendaId,
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
        expect(response.data.data.items.length).toBeGreaterThanOrEqual(5);
    });
});
