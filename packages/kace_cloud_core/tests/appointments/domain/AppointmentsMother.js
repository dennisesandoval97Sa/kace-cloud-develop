import { v4 as uuidv4 } from 'uuid';
import { Appointment } from '../../../src/appointments/domain/Appointment.js';

export class AppointmentsMother {
    static dto(overrides = {}) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const date = tomorrow.toISOString().split('T')[0];
        const startTime = `${date}T15:00:00.000Z`;
        const endTime = `${date}T16:00:00.000Z`;

        const defaults = {
            id: uuidv4(),
            case_id: uuidv4(),
            agenda_id: uuidv4(),
            date: now.toISOString().split('T')[0],
            start_time: startTime,
            end_time: endTime,
            custom_fields: { key1: 'value1', key2: 'value2' },
            assigned_to: uuidv4(),
            created_at: now.toISOString(),
            created_by: uuidv4(),
            is_completed: false,
            is_canceled: false,
        };

        return { ...defaults, ...overrides };
    }

    static async create(repository, overrides = {}) {
        const appointmentDto = AppointmentsMother.dto(overrides);
        const appointment = Appointment.create(appointmentDto);
        await repository.save(appointment);
        return appointment;
    }

    static async createMany(repository, quantity, overrides = {}) {
        const appointments = [];
        for (let i = 0; i < quantity; i++) {
            appointments.push(await AppointmentsMother.create(repository, overrides));
        }
        return appointments;
    }
}
