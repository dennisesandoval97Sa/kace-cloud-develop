import {
    CaseAttachment,
    CaseAttachmentCollectionResponse,
    CaseAttachmentResponse,
    ValueObjectSize,
    ValueObjectType,
} from '../../src/case-attachments';
import { v4 as uuidv4 } from 'uuid';
import CaseAttachmentMother from './domain/CaseAttachmentMother';

describe('CaseAttachment Entity', () => {
    const dto = CaseAttachmentMother.dto();

    it('should create a CaseAttachment with valid data', () => {
        const caseAttachment = CaseAttachment.create(dto);
        expect(caseAttachment.id.value).toBe(dto.id);
        expect(caseAttachment.description.value).toBe(dto.description);
        expect(caseAttachment.size.value).toBe(dto.size);
        expect(caseAttachment.path.value).toBe(dto.path);
        expect(caseAttachment.type.value).toBe(dto.type);
        expect(caseAttachment.is_active.value).toBe(dto.is_active);
        expect(caseAttachment.created_by.value).toBe(dto.created_by);
        expect(caseAttachment.created_at.value).toBe(dto.created_at);
    });

    it('should store attachment_type when provided', () => {
        const dtoWithTipo = CaseAttachmentMother.dto({ attachment_type: 'Foto frontal' });
        const caseAttachment = CaseAttachment.create(dtoWithTipo);
        expect(caseAttachment.attachment_type).toBe('Foto frontal');
    });

    it('should default attachment_type to null when not provided', () => {
        const dtoWithoutTipo = CaseAttachmentMother.dto();
        delete dtoWithoutTipo.attachment_type;
        const caseAttachment = CaseAttachment.create(dtoWithoutTipo);
        expect(caseAttachment.attachment_type).toBeNull();
    });

    it('should not pollute changedAttributes on construction', () => {
        const caseAttachment = CaseAttachment.create(CaseAttachmentMother.dto({ attachment_type: 'Cedula' }));
        expect(caseAttachment.changedAttributes).toEqual({});
    });

    it('should track attachment_type in changedAttributes when set via setter', () => {
        const caseAttachment = CaseAttachment.create(CaseAttachmentMother.dto({ attachment_type: 'Rut' }));
        caseAttachment.attachment_type = 'Cedula del';
        expect(caseAttachment.attachment_type).toBe('Cedula del');
        expect(caseAttachment.changedAttributes.attachment_type).toBe('Cedula del');
    });

    it('should not dirty changedAttributes when attachment_type is set to the same value', () => {
        const caseAttachment = CaseAttachment.create(CaseAttachmentMother.dto({ attachment_type: 'Rut' }));
        caseAttachment.attachment_type = 'Rut';
        expect(caseAttachment.changedAttributes).toEqual({});
    });

    it('should track attachment_type in changedAttributes when updated via update(dto)', () => {
        const caseAttachment = CaseAttachment.create(CaseAttachmentMother.dto({ attachment_type: 'Rut' }));
        caseAttachment.update({ attachment_type: 'Oferta' });
        expect(caseAttachment.attachment_type).toBe('Oferta');
        expect(caseAttachment.changedAttributes.attachment_type).toBe('Oferta');
    });

    it('should track attachment_type set to null in changedAttributes', () => {
        const caseAttachment = CaseAttachment.create(CaseAttachmentMother.dto({ attachment_type: 'Cedula' }));
        caseAttachment.attachment_type = null;
        expect(caseAttachment.attachment_type).toBeNull();
        expect(caseAttachment.changedAttributes.attachment_type).toBeNull();
    });

    it('should update CaseAttachment data', () => {
        const caseAttachment = CaseAttachment.create(dto);
        const newData = {
            description: 'Updated Description',
            size: 2048,
            path: 'new/path/to/file',
            type: 2,
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        caseAttachment.description = newData.description;
        caseAttachment.size = newData.size;
        caseAttachment.path = newData.path;
        caseAttachment.type = newData.type;
        caseAttachment.is_active = newData.is_active;
        caseAttachment.updated_at = newData.updated_at;
        caseAttachment.updated_by = newData.updated_by;

        expect(caseAttachment.description.value).toBe(newData.description);
        expect(caseAttachment.size.value).toBe(newData.size);
        expect(caseAttachment.path.value).toBe(newData.path);
        expect(caseAttachment.type.value).toBe(newData.type);
        expect(caseAttachment.is_active.value).toBe(newData.is_active);
        expect(caseAttachment.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => CaseAttachment.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const caseAttachment = CaseAttachment.create(dto);
        const sameData = { ...dto };

        caseAttachment.description = sameData.description;
        caseAttachment.size = sameData.size;
        caseAttachment.path = sameData.path;
        caseAttachment.type = sameData.type;
        caseAttachment.is_active = sameData.is_active;

        expect(caseAttachment.changedAttributes).toEqual({});
    });

    it('marks a CaseAttachment instance as deleted', () => {
        const caseAttachment = CaseAttachment.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        caseAttachment.deleted_at = deleteDto.deleted_at;
        caseAttachment.deleted_by = deleteDto.deleted_by;

        expect(caseAttachment.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(caseAttachment.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const caseAttachment = CaseAttachment.create(dto);
        const deleteDto = {};
        caseAttachment.deleted_at = null;
        caseAttachment.deleted_by = undefined;

        expect(caseAttachment.deleted_at.value).toBeNull();
        expect(caseAttachment.deleted_by.value).toBeUndefined();
    });

    it('flushes changes in CaseAttachment instance', () => {
        const caseAttachment = CaseAttachment.create(dto);
        const updateDto = {
            description: 'Updated Description',
            size: 2048,
            path: 'new/path/to/file',
            type: 2,
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        caseAttachment.description = updateDto.description;
        caseAttachment.size = updateDto.size;
        caseAttachment.path = updateDto.path;
        caseAttachment.type = updateDto.type;
        caseAttachment.is_active = updateDto.is_active;
        caseAttachment.updated_at = updateDto.updated_at;
        caseAttachment.updated_by = updateDto.updated_by;
        caseAttachment.flushChanges();

        expect(caseAttachment.changedAttributes).toEqual({});
    });
});

describe('CaseAttachment Response Tests', () => {
    it('converts CaseAttachment object to JSON representation', () => {
        const caseAttachment = CaseAttachment.create(CaseAttachmentMother.dto());
        const caseAttachmentResponse = new CaseAttachmentResponse(caseAttachment);

        const json = caseAttachmentResponse.toJson();

        expect(json).toEqual({
            data: {
                id: caseAttachment.id.value,
                case_id: caseAttachment.case_id.value,
                description: caseAttachment.description.value,
                size: caseAttachment.size.value,
                path: caseAttachment.path.value,
                type: caseAttachment.type.value,
                is_active: caseAttachment.is_active.value,
                attachment_type: caseAttachment.attachment_type ?? null,
                created_at: caseAttachment.created_at.value,
                updated_at: caseAttachment.updated_at.value,
                created_by: caseAttachment.created_by.value,
                updated_by: caseAttachment.updated_by.value,
            },
        });
    });

    it('returns an empty object if CaseAttachment is not provided', () => {
        const caseAttachmentResponse = new CaseAttachmentResponse(null);
        expect(caseAttachmentResponse.toJson()).toEqual({});
    });
});

describe('CaseAttachment Collection Response Tests', () => {
    it('converts CaseAttachment collection to JSON representation', () => {
        const caseAttachmentCollection = [
            CaseAttachment.create(CaseAttachmentMother.dto()),
            CaseAttachment.create(CaseAttachmentMother.dto()),
        ];
        const caseAttachmentCollectionResponse = new CaseAttachmentCollectionResponse(
            caseAttachmentCollection,
            caseAttachmentCollection.length
        );

        const json = caseAttachmentCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: caseAttachmentCollection.map(
                    (caseAttachment) => new CaseAttachmentResponse(caseAttachment).toJson().data
                ),
            },
            metadata: {
                count: caseAttachmentCollection.length,
            },
        });
    });
});

describe('ValueObjectSize Tests', () => {
    it('should create an instance with valid value', () => {
        const validValue = 2048;
        const valueObject = new ValueObjectSize('size', validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectSize);
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectSize('size', value)).toThrow('The value cannot be null');
        });
    });

    it('should throw an error if the size is not a number', () => {
        const invalidValue = 'not-a-number';
        expect(() => new ValueObjectSize('size', invalidValue)).toThrow('size: The value must be an integer');
    });

    it('should not throw an error if the size is a valid number', () => {
        const validValue = 2048;
        expect(() => new ValueObjectSize('size', validValue)).not.toThrow();
    });
});

describe('ValueObjectType Tests', () => {
    it('should create an instance with valid value', () => {
        const validValue = 1;
        const valueObject = new ValueObjectType('attachmentType', validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectType);
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectType('attachmentType', value)).toThrow('The value cannot be null');
        });
    });

    it('should throw an error if the type is not a number', () => {
        const invalidValue = 'not-a-number';
        expect(() => new ValueObjectType('attachmentType', invalidValue)).toThrow(
            'attachmentType: The value must be an integer'
        );
    });

    it('should call AttachmentTypeEnum.fromValue for invalid value', () => {
        const invalidValue = 3;
        expect(() => new ValueObjectType('attachmentType', invalidValue)).toThrow(
            'Invalid value: 3. Allowed values are:  1, 2'
        );
    });
});
