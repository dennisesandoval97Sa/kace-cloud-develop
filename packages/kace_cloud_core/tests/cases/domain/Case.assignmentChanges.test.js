import { v4 as uuidv4 } from 'uuid';
import { Case } from '../../../src/cases';
import CasesMother from './CasesMother';

describe('Case assignment changedAttributes', () => {
    it('does not record transicion_id when assigned the same value', () => {
        const transicionId = uuidv4();
        const kase = Case.create(CasesMother.dto({ transicion_id: transicionId }));

        kase.transicion_id = transicionId;

        expect(kase.changedAttributes).not.toHaveProperty('transicion_id');
        expect(kase.transicion_id.value).toBe(transicionId);
    });

    it('does not record responsable_id when assigned the same value', () => {
        const responsableId = uuidv4();
        const kase = Case.create(CasesMother.dto({ responsable_id: responsableId }));

        kase.responsable_id = responsableId;

        expect(kase.changedAttributes).not.toHaveProperty('responsable_id');
        expect(kase.responsable_id.value).toBe(responsableId);
    });

    it('records transicion_id when assigned a different value', () => {
        const kase = Case.create(CasesMother.dto({ transicion_id: uuidv4() }));
        const nextTransitionId = uuidv4();

        kase.transicion_id = nextTransitionId;

        expect(kase.changedAttributes.transicion_id).toBe(nextTransitionId);
        expect(kase.transicion_id.value).toBe(nextTransitionId);
    });

    it('records responsable_id when assigned a different value', () => {
        const kase = Case.create(CasesMother.dto({ responsable_id: uuidv4() }));
        const nextResponsableId = uuidv4();

        kase.responsable_id = nextResponsableId;

        expect(kase.changedAttributes.responsable_id).toBe(nextResponsableId);
        expect(kase.responsable_id.value).toBe(nextResponsableId);
    });
});
