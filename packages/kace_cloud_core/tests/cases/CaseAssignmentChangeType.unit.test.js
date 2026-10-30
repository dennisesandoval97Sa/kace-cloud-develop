import { v4 as uuidv4 } from 'uuid';
import CasesMother from './domain/CasesMother';
import { Case } from '../../src/cases/domain/Case.js';
import { ValueObjectAssignmentChangeType } from '../../src/cases/domain/ValueObjectAssignmentChangeType.js';

describe('Case.assignment_change_type', () => {
    it('hydrates from the dto and serializes in toJson', () => {
        const dto = { ...CasesMother.dto(), assignment_change_type: 'action' };
        const kase = Case.create(dto);
        expect(kase.assignment_change_type.value).toBe('action');
        expect(kase.toJson().assignment_change_type).toBe('action');
    });

    it('defaults to undefined when the dto omits it', () => {
        const dto = { ...CasesMother.dto() };
        delete dto.assignment_change_type;
        const kase = Case.create(dto);
        expect(kase.assignment_change_type.value).toBeUndefined();
    });

    it('hydrates a null value from the dto as null', () => {
        const dto = { ...CasesMother.dto(), assignment_change_type: null };
        const kase = Case.create(dto);
        expect(kase.assignment_change_type.value).toBeNull();
    });

    it('setter records the change in changedAttributes', () => {
        const kase = Case.create(CasesMother.dto());
        kase.assignment_change_type = ValueObjectAssignmentChangeType.MANUAL;
        expect(kase.changedAttributes.assignment_change_type).toBe('manual');
    });

    it('assignToUser applies the provided type', () => {
        const kase = Case.create(CasesMother.dto());
        kase.assignToUser({
            responsable_id: uuidv4(),
            grupo_id: uuidv4(),
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
            assignment_change_type: 'action',
        });
        expect(kase.assignment_change_type.value).toBe('action');
    });

    it('assignToUser defaults to manual when type is omitted', () => {
        const kase = Case.create(CasesMother.dto());
        kase.assignToUser({
            responsable_id: uuidv4(),
            grupo_id: uuidv4(),
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        });
        expect(kase.assignment_change_type.value).toBe('manual');
    });
});
