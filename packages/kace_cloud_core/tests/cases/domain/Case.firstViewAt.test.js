import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Case } from '../../../src/cases';
import CasesMother from '../../cases/domain/CasesMother';

describe('Case.first_view_at', () => {
    const aFirstView = dayjs().subtract(1, 'hour').toISOString();

    it('exposes first_view_at in toJson()', () => {
        const kase = Case.create(CasesMother.dto({ first_view_at: aFirstView }));

        expect(kase.toJson().first_view_at).toBe(aFirstView);
    });

    it('defaults to null when not provided', () => {
        const kase = Case.create(CasesMother.dto());

        expect(kase.first_view_at.value).toBeNull();
    });

    describe('reset on reassignment', () => {
        it('resets first_view_at to null when reassigned to a different responsible', () => {
            const responsableA = uuidv4();
            const responsableB = uuidv4();
            const kase = Case.create(CasesMother.dto({ responsable_id: responsableA, first_view_at: aFirstView }));

            kase.responsable_id = responsableB;

            expect(kase.first_view_at.value).toBeNull();
            expect(kase.changedAttributes.first_view_at).toBeNull();
            expect(kase.changedAttributes.responsable_id).toBe(responsableB);
        });

        it('does NOT reset first_view_at when reassigned to the same responsible', () => {
            const responsableA = uuidv4();
            const kase = Case.create(CasesMother.dto({ responsable_id: responsableA, first_view_at: aFirstView }));

            kase.responsable_id = responsableA;

            expect(kase.first_view_at.value).toBe(aFirstView);
            expect(kase.changedAttributes).not.toHaveProperty('first_view_at');
        });

        it('does NOT record a first_view_at change when it was already null', () => {
            const kase = Case.create(CasesMother.dto({ responsable_id: uuidv4(), first_view_at: null }));

            kase.responsable_id = uuidv4();

            expect(kase.first_view_at.value).toBeNull();
            expect(kase.changedAttributes).not.toHaveProperty('first_view_at');
        });

        it('resets first_view_at through assignToUser when responsible changes', () => {
            const kase = Case.create(CasesMother.dto({ responsable_id: uuidv4(), first_view_at: aFirstView }));

            kase.assignToUser({
                responsable_id: uuidv4(),
                grupo_id: uuidv4(),
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
                update_source: null,
            });

            expect(kase.first_view_at.value).toBeNull();
        });
    });

    describe('clone()', () => {
        it('starts the cloned case with first_view_at in null', () => {
            const kase = Case.create(CasesMother.dto({ first_view_at: aFirstView }));

            const cloned = kase.clone(uuidv4(), uuidv4());

            expect(cloned.first_view_at.value).toBeNull();
        });
    });

    describe('registerFirstViewBy()', () => {
        it('sets first_view_at when the viewer is the current responsible and it was null', () => {
            const responsable = uuidv4();
            const when = new Date();
            const kase = Case.create(CasesMother.dto({ responsable_id: responsable, first_view_at: null }));

            const applied = kase.registerFirstViewBy(responsable, when);

            expect(applied).toBe(when.toISOString());
            expect(kase.first_view_at.value).toBe(when.toISOString());
        });

        it('is idempotent: does nothing if first_view_at is already set', () => {
            const responsable = uuidv4();
            const kase = Case.create(CasesMother.dto({ responsable_id: responsable, first_view_at: aFirstView }));

            const applied = kase.registerFirstViewBy(responsable, new Date());

            expect(applied).toBeNull();
            expect(kase.first_view_at.value).toBe(aFirstView);
        });

        it('does nothing when the viewer is not the current responsible', () => {
            const kase = Case.create(CasesMother.dto({ responsable_id: uuidv4(), first_view_at: null }));

            const applied = kase.registerFirstViewBy(uuidv4(), new Date());

            expect(applied).toBeNull();
            expect(kase.first_view_at.value).toBeNull();
        });
    });
});
