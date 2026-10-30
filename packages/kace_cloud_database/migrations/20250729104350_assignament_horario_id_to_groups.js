import { globalUserId } from '../seeds/20241125105900_usuario_base.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    let shift = await knex('shift_management').first('id');

    if (!shift) {
        const work_days = {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' },
        };

        const newId = uuidv4();

        const [created] = await knex('shift_management')
            .insert({
                id: newId,
                work_days: JSON.stringify(work_days),
                holiday_dates: JSON.stringify(['2024-09-03', '2024-12-29']),
                description: 'Horario inicial',
                created_at: knex.fn.now(),
                created_by: globalUserId,
            })
            .returning('id');
        shift = { id: created.id ?? created };
    }

    await knex('grupos').whereNull('horario_id').update({ horario_id: shift.id });
}

export async function down() {
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    console.warn(
        '⚠️ Advertencia: Esta migración "20250729104350_assignament_horario_id_to_groups.js" no debería revertirse. No se realizará ninguna acción.'
    );
}
