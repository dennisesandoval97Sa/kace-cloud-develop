import { SubcasesRelationship } from '../../src/cases/domain/SubcasesRelationship';
import SubcasesMother from './domain/SubcasesMother';
import { ValueObjectUuid } from '../../src/shared';
import { SubCaseRelationCollectionResponse } from '../../src/cases/application/SubCaseRelationCollectionResponse.js';

describe('SubcasesRelationship Entity', () => {
    const dto = SubcasesMother.dto();

    it('should create a SubcasesRelationship with valid data', () => {
        const subcaseRelationship = SubcasesRelationship.create(dto);
        expect(subcaseRelationship.parent_case_id).toBeInstanceOf(ValueObjectUuid);
        expect(subcaseRelationship.child_case_id).toBeInstanceOf(ValueObjectUuid);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, parent_case_id: 'invalid-uuid' };

        expect(() => SubcasesRelationship.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });
});
describe('SubcasesRelationship Responses Tests', () => {
    it('handles empty collection', () => {
        const collectionResponse = new SubCaseRelationCollectionResponse([], 0);
        expect(collectionResponse.toJson()).toEqual({
            data: { items: [] },
            metadata: { count: 0 },
        });
    });
});
