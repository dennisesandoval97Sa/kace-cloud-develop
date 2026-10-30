import { chance, Factory, uuidv4 } from './Factory.js';
import { KnexShiftManagementRepository, ShiftManagement } from '../shift-management/index.js';
import dayjs from 'dayjs';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD');

export class ShiftManagementFactory extends Factory {
    /**
     * @param {*} knexConfig - instancia de knex
     */
    constructor(knexConfig) {
        super(KnexShiftManagementRepository, ShiftManagement, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            holiday_dates: [formatDate(chance.date({ year: 2024 })), formatDate(chance.date({ year: 2024 }))],
            work_days: {
                monday: { start: '09:00', end: '17:00' },
                tuesday: { start: '09:00', end: '17:00' },
                wednesday: { start: '09:00', end: '17:00' },
                thursday: { start: '09:00', end: '17:00' },
                friday: { start: '09:00', end: '17:00' },
            },
            description: () => chance.sentence({ words: 5 }),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        })
            .afterMaking((sm) => {
                Helper.logInfo(`ShiftManagement made with id: ${sm.id.value}`);
            })
            .afterCreating((sm) => {
                Helper.logInfo(`ShiftManagement created with id: ${sm.id.value}`);
            });
    }
}
