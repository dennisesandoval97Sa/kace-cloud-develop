import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Case } from '../../../src/cases';
import CasesMother from '../../cases/domain/CasesMother';

describe('Case.last_assigned_at', () => {
    const aPastAssignment = dayjs().subtract(1, 'day').toISOString();

    it('exposes last_assigned_at in toJson()', () => {
        const kase = Case.create(CasesMother.dto({ last_assigned_at: aPastAssignment }));

        expect(kase.toJson().last_assigned_at).toBe(aPastAssignment);
    });

    it('does NOT set last_assigned_at on construction even when a responsible is provided', () => {
        const kase = Case.create(CasesMother.dto({ responsable_id: uuidv4(), last_assigned_at: null }));

        expect(kase.last_assigned_at.value).toBeNull();
        expect(kase.changedAttributes).not.toHaveProperty('last_assigned_at');
    });

    describe('update on reassignment', () => {
        it('updates last_assigned_at when reassigned to a different responsible', () => {
            const kase = Case.create(CasesMother.dto({ responsable_id: uuidv4(), last_assigned_at: aPastAssignment }));

            kase.responsable_id = uuidv4();

            expect(kase.changedAttributes).toHaveProperty('last_assigned_at');
            expect(typeof kase.changedAttributes.last_assigned_at).toBe('string');
            expect(kase.changedAttributes.last_assigned_at).toBe(kase.last_assigned_at.value);
            expect(kase.last_assigned_at.value).not.toBe(aPastAssignment);
        });

        it('does NOT update last_assigned_at when reassigned to the same responsible', () => {
            const responsable = uuidv4();
            const kase = Case.create(
                CasesMother.dto({ responsable_id: responsable, last_assigned_at: aPastAssignment })
            );

            kase.responsable_id = responsable;

            expect(kase.changedAttributes).not.toHaveProperty('last_assigned_at');
            expect(kase.last_assigned_at.value).toBe(aPastAssignment);
        });

        it('updates last_assigned_at through update() when responsible changes', () => {
            const kase = Case.create(CasesMother.dto({ responsable_id: uuidv4(), last_assigned_at: aPastAssignment }));

            kase.update({ responsable_id: uuidv4() });

            expect(kase.changedAttributes).toHaveProperty('last_assigned_at');
            expect(kase.changedAttributes.last_assigned_at).toBe(kase.last_assigned_at.value);
        });

        it('updates last_assigned_at through assignToUser when responsible changes', () => {
            const kase = Case.create(CasesMother.dto({ responsable_id: uuidv4(), last_assigned_at: aPastAssignment }));

            kase.assignToUser({
                responsable_id: uuidv4(),
                grupo_id: uuidv4(),
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
                update_source: null,
            });

            expect(kase.changedAttributes).toHaveProperty('last_assigned_at');
            expect(kase.changedAttributes.last_assigned_at).toBe(kase.last_assigned_at.value);
        });
    });
});
