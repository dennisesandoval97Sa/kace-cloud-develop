import CasesMother from './domain/CasesMother';
import { Case } from '../../src/cases/domain/Case.js';
import { CaseResponse } from '../../src/cases/application/CaseResponse.js';

describe('CaseResponse — assignment_change_type', () => {
    it('includes assignment_change_type in data', () => {
        const kase = Case.create({ ...CasesMother.dto(), assignment_change_type: 'manual' });
        const json = new CaseResponse(kase).toJson();
        expect(json.data.assignment_change_type).toBe('manual');
    });
});
