import {
    CaseDescription,
    CaseDescriptionCollectionResponse,
    CaseDescriptionResponse,
} from '../../src/case-descriptions';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectString, ValueObjectTimestamp, ValueObjectUuid } from '../../src/shared';
import CaseDescriptionsMother from './domain/CaseDescriptionsMother';

describe('CaseDescription Entity', () => {
    const dto = CaseDescriptionsMother.dto();

    it('should create a CaseDescription with valid data', () => {
        const caseDescription = CaseDescription.create(dto);
        expect(caseDescription.id).toBeInstanceOf(ValueObjectUuid);
        expect(caseDescription.descripcion).toBeInstanceOf(ValueObjectString);
        expect(caseDescription.created_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(caseDescription.created_by).toBeInstanceOf(ValueObjectUuid);
    });

    it('should update CaseDescription data', () => {
        const caseDescription = CaseDescription.create(dto);
        const newData = {
            descripcion: 'Updated Description',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        caseDescription.update(newData);

        expect(caseDescription.descripcion.value).toBe(newData.descripcion);
        expect(caseDescription.changedAttributes).toEqual(newData);
    });

    it('should update CaseDescription attributes via setters', () => {
        const caseDescription = CaseDescription.create(dto);

        caseDescription.descripcion = 'Updated Description';
        caseDescription.updated_by = uuidv4();

        expect(caseDescription.changedAttributes).toEqual({
            descripcion: 'Updated Description',
            updated_by: caseDescription.updated_by.value,
        });
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => CaseDescription.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const caseDescription = CaseDescription.create({ ...dto });

        caseDescription.update({ descripcion: dto.descripcion });

        expect(caseDescription.changedAttributes).toEqual({});
    });

    it('flushes changes in CaseDescription instance', () => {
        const caseDescription = CaseDescription.create(dto);

        const updateDto = {
            descripcion: 'Updated Description',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        caseDescription.update(updateDto);
        caseDescription.flushChanges();

        expect(caseDescription.changedAttributes).toEqual({});
    });
});

describe('CaseDescription Responses Tests', () => {
    it('converts CaseDescription object to JSON representation', () => {
        const caseDescription = CaseDescription.create(CaseDescriptionsMother.dto());
        const caseDescriptionResponse = new CaseDescriptionResponse(caseDescription);

        const json = caseDescriptionResponse.toJson();

        expect(json).toEqual({
            data: {
                id: caseDescription.id.value,
                descripcion: caseDescription.descripcion.value,
                created_at: caseDescription.created_at.value,
                updated_at: caseDescription.updated_at.value,
                created_by: caseDescription.created_by.value,
                updated_by: caseDescription.updated_by.value,
            },
        });
    });

    it('returns an empty object if case description is not provided', () => {
        const caseDescriptionResponse = new CaseDescriptionResponse(null);
        const json = caseDescriptionResponse.toJson();

        expect(json).toEqual({});
    });

    it('converts CaseDescriptionCollection to JSON representation', () => {
        const caseDescriptionCollection = [
            new CaseDescription(CaseDescriptionsMother.dto()),
            new CaseDescription(CaseDescriptionsMother.dto()),
        ];
        const caseDescriptionCollectionResponse = new CaseDescriptionCollectionResponse(
            caseDescriptionCollection,
            caseDescriptionCollection.length
        );

        const json = caseDescriptionCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: caseDescriptionCollection.map(
                    (caseDescription) => new CaseDescriptionResponse(caseDescription).toJson().data
                ),
            },
            metadata: {
                count: caseDescriptionCollection.length,
            },
        });
    });
});
