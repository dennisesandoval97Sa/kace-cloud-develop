import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

describe('FieldCatalog — assignment_change_type', () => {
    const catalog = createCasesFieldCatalog();

    it('resolves cases.assignment_change_type to a column descriptor', () => {
        const descriptor = catalog.resolve('cases.assignment_change_type');
        expect(descriptor).toEqual({ kind: 'column', table: 'cases', column: 'assignment_change_type' });
    });
});
