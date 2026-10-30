import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { GroupDetailFinder, GroupScheduleGuard, Groups } from '../../src/grupos';
import { ShiftManagement } from '../../src/shift-management';
import { CustomError } from '../../src/shared/index.js';
import { GroupsMother } from './domain/GroupsMother.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';

describe('GroupDetailFinder', () => {
    const buildGroup = () => Groups.create(GroupsMother.dto());

    const buildSchedule = (id, { deleted = false } = {}) => {
        const schedule = ShiftManagement.create({ ...ShiftManagementMother.dto(), id, description: 'Horario A' });
        if (deleted) {
            schedule.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });
        }
        return schedule;
    };

    const finderFor = (group, schedule) => {
        const shiftManagementRepository = { find: jest.fn().mockResolvedValue(schedule) };
        const finder = new GroupDetailFinder(
            { find: jest.fn().mockResolvedValue(group) },
            new GroupScheduleGuard(shiftManagementRepository)
        );
        return { finder, shiftManagementRepository };
    };

    it('returns the group with its schedule id and description when the schedule is available', async () => {
        const group = buildGroup();
        const horarioId = group.horario_id.value;

        const { data } = (await finderFor(group, buildSchedule(horarioId)).finder.execute(group.id.value)).toJson();

        expect(data).toMatchObject({
            id: group.id.value,
            nombre: group.nombre.value,
            horario_id: horarioId,
            horario_description: 'Horario A',
        });
    });

    it('looks the schedule up by the horario_id stored on the group', async () => {
        const group = buildGroup();
        const { finder, shiftManagementRepository } = finderFor(group, null);

        await finder.execute(group.id.value);

        expect(shiftManagementRepository.find).toHaveBeenCalledTimes(1);
        expect(shiftManagementRepository.find.mock.calls[0][0].value).toBe(group.horario_id.value);
    });

    it('returns horario_id null when the saved schedule was deleted', async () => {
        const group = buildGroup();
        const deleted = buildSchedule(group.horario_id.value, { deleted: true });

        const { data } = (await finderFor(group, deleted).finder.execute(group.id.value)).toJson();

        expect(data).toMatchObject({ nombre: group.nombre.value, horario_id: null, horario_description: '' });
    });

    it('returns horario_id null when the saved schedule does not exist', async () => {
        const group = buildGroup();

        const { data } = (await finderFor(group, null).finder.execute(group.id.value)).toJson();

        expect(data).toMatchObject({ horario_id: null, horario_description: '' });
    });

    it.each([
        ['available', (id) => buildSchedule(id), 'Horario A'],
        ['deleted', (id) => buildSchedule(id, { deleted: true }), ''],
        ['missing', () => null, ''],
    ])(
        'keeps the description at its previous top-level location too when the schedule is %s',
        async (_case, scheduleFor, description) => {
            const group = buildGroup();

            const response = (
                await finderFor(group, scheduleFor(group.horario_id.value)).finder.execute(group.id.value)
            ).toJson();

            expect(response.horario_description).toBe(description);
            expect(response.data.horario_description).toBe(description);
        }
    );

    it('throws a 404 without looking the schedule up when the group does not exist', async () => {
        const { finder, shiftManagementRepository } = finderFor(null, null);

        const error = await finder.execute(uuidv4()).catch((e) => e);

        expect(error).toBeInstanceOf(CustomError);
        expect(error.statusCode).toBe(404);
        expect(shiftManagementRepository.find).not.toHaveBeenCalled();
    });
});
