import { v4 as uuidv4 } from 'uuid';
import { AppointmentTimeSlots } from '../../../src/appointment-time-slots/domain/AppointmentTimeSlots';

export class AppointmentTimeSlotsMother {
    static dto(agendaId = uuidv4(), start_time = '08:00', end_time = '09:00') {
        return {
            id: uuidv4(),
            description: 'description',
            start_time,
            end_time,
            agenda_id: agendaId,
            is_active: true,
            max_appointments: 10,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static async create(repository, agendaId = uuidv4(), start_time = '08:00', end_time = '09:00') {
        const appointmentTimeSlotsDto = this.dto(agendaId, start_time, end_time);
        const appointmentTimeSlots = AppointmentTimeSlots.create(appointmentTimeSlotsDto);
        await repository.save(appointmentTimeSlots);
        return appointmentTimeSlots;
    }

    static async createMany(repository, quantity = 3, agendaId = uuidv4(), start_time = '08:00', end_time = '09:00') {
        const appointmentTimeSlots = [];

        for (let i = 0; i < quantity; i++) {
            const appointmentTimeSlot = await this.create(repository, agendaId, start_time, end_time);
            appointmentTimeSlots.push(appointmentTimeSlot);
        }

        return appointmentTimeSlots;
    }
}
