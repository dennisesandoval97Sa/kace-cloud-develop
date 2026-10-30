import { DeleteFieldsDoNotExistError, InvalidArgumentError } from '../../src/shared/index.js';
import { S3File, S3FileCollectionResponse, S3FileResponse } from '../../src/s3-files';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectBoolean, ValueObjectDescription, ValueObjectTimestamp, ValueObjectUuid } from '../../src/shared';
import {
    ValueObjectFileName,
    ValueObjectOrigin,
    ValueObjectS3FileName,
    ValueObjectSize,
    ValueObjectURL,
} from '../../src/s3-files/domain/value-objects';
import S3FileMother from './domain/S3FileMother';

describe('S3File Entity', () => {
    const dto = S3FileMother.dto();

    it('should create an S3File with valid data', () => {
        const s3file = S3File.create(dto);
        expect(s3file.id).toBeInstanceOf(ValueObjectUuid);
        expect(s3file.description).toBeInstanceOf(ValueObjectDescription);
        expect(s3file.file_name).toBeInstanceOf(ValueObjectFileName);
        expect(s3file.s3_file_name).toBeInstanceOf(ValueObjectS3FileName);
        expect(s3file.url).toBeInstanceOf(ValueObjectURL);
        expect(s3file.size).toBeInstanceOf(ValueObjectSize);
        expect(s3file.is_active).toBeInstanceOf(ValueObjectBoolean);
        expect(s3file.created_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(s3file.created_by).toBeInstanceOf(ValueObjectUuid);
    });

    it('should update S3File data', () => {
        const s3file = S3File.create(dto);
        const newData = {
            description: 'Updated Name',
            file_name: 'updated_object_name',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        s3file.update(newData);

        expect(s3file.description.value).toBe(newData.description);
        expect(s3file.file_name.value).toBe(newData.file_name);
        expect(s3file.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => S3File.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const s3file = S3File.create(dto);
        const unchangedData = {
            description: dto.description,
            file_name: dto.file_name,
            is_active: dto.is_active,
        };
        s3file.update(unchangedData);

        expect(s3file.changedAttributes).toEqual({});
    });

    it('marks an S3File instance as deleted', () => {
        const s3file = S3File.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        s3file.delete(deleteDto);

        expect(s3file.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(s3file.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const s3file = S3File.create(dto);
        const deleteDto = {};

        expect(() => s3file.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in S3File instance', () => {
        const s3file = S3File.create(dto);
        const updateDto = {
            description: 'Updated Name',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        s3file.update(updateDto);
        s3file.flushChanges();

        expect(s3file.changedAttributes).toEqual({});
    });
});

describe('S3FileResponse Tests', () => {
    it('converts S3File object to JSON representation', () => {
        const s3file = S3File.create(S3FileMother.dto());
        const s3fileResponse = new S3FileResponse(s3file);

        const json = s3fileResponse.toJson();

        expect(json).toEqual({
            data: {
                id: s3file.id.value,
                description: s3file.description.value,
                file_name: s3file.file_name.value,
                s3_file_name: s3file.s3_file_name.value,
                url: s3file.url.value,
                size: s3file.size.value,
                origin: s3file.origin.value,
                is_active: s3file.is_active.value,
                expired_at: s3file.expired_at.value,
                created_at: s3file.created_at.value,
                updated_at: s3file.updated_at.value,
                created_by: s3file.created_by.value,
                updated_by: s3file.updated_by.value,
            },
        });
    });

    it('returns an empty object if S3File is not provided', () => {
        const s3fileResponse = new S3FileResponse(null);
        const json = s3fileResponse.toJson();

        expect(json).toEqual({});
    });

    it('converts S3FileCollection to JSON representation', () => {
        const s3fileCollection = [S3File.create(S3FileMother.dto()), S3File.create(S3FileMother.dto())];
        const s3fileCollectionResponse = new S3FileCollectionResponse(s3fileCollection, s3fileCollection.length);

        const json = s3fileCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: s3fileCollection.map((s3file) => new S3FileResponse(s3file).toJson().data),
            },
            metadata: {
                count: s3fileCollection.length,
            },
        });
    });
});

describe('ValueObjectFileName Tests', () => {
    it('should create a ValueObjectFileName with valid value', () => {
        const valueObject = new ValueObjectFileName('ValidFileName');
        expect(valueObject).toBeInstanceOf(ValueObjectFileName);
        expect(valueObject.value).toBe('ValidFileName');
    });

    it('should throw an error when value is null and nullable is false', () => {
        expect(() => new ValueObjectFileName(null, false)).toThrow('file_name: The value cannot be null');
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectFileName(null, true)).not.toThrow();
    });

    it('should throw an error when value exceeds maximum length', () => {
        const longValue = 'A'.repeat(101);
        expect(() => new ValueObjectFileName(longValue)).toThrow(
            'file_name: The value must be at most 100 characters long'
        );
    });

    it('should throw an error when value is not a string', () => {
        expect(() => new ValueObjectFileName(123)).toThrow('file_name: The value must be a string');
    });
});

describe('ValueObjectS3FileName Tests', () => {
    it('should create a ValueObjectS3FileName with valid value', () => {
        const valueObject = new ValueObjectS3FileName('ValidS3FileName');
        expect(valueObject).toBeInstanceOf(ValueObjectS3FileName);
        expect(valueObject.value).toBe('ValidS3FileName');
    });

    it('should throw an error when value is null and nullable is false', () => {
        expect(() => new ValueObjectS3FileName(null, false)).toThrow('s3_file_name: The value cannot be null');
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectS3FileName(null, true)).not.toThrow();
    });

    it('should throw an error when value exceeds maximum length', () => {
        const longValue = 'A'.repeat(101);
        expect(() => new ValueObjectS3FileName(longValue)).toThrow(
            's3_file_name: The value must be at most 100 characters long'
        );
    });

    it('should throw an error when value is not a string', () => {
        expect(() => new ValueObjectS3FileName(123)).toThrow('s3_file_name: The value must be a string');
    });
});

describe('ValueObjectOrigin Tests', () => {
    it('should create a ValueObjectOrigin with valid value', () => {
        const valueObject = new ValueObjectOrigin('ValidOrigin');
        expect(valueObject).toBeInstanceOf(ValueObjectOrigin);
        expect(valueObject.value).toBe('ValidOrigin');
    });

    it('should throw an error when value is null and nullable is false', () => {
        expect(() => new ValueObjectOrigin(null, false)).toThrow('origin: The value cannot be null');
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectOrigin(null, true)).not.toThrow();
    });

    it('should throw an error when value exceeds maximum length', () => {
        const longValue = 'A'.repeat(101);
        expect(() => new ValueObjectOrigin(longValue)).toThrow('origin: The value must be at most 100 characters long');
    });

    it('should throw an error when value is not a string', () => {
        expect(() => new ValueObjectOrigin(123)).toThrow('origin: The value must be a string');
    });
});

describe('ValueObjectSize Tests', () => {
    it('should create a ValueObjectSize with a valid number', () => {
        const valueObject = new ValueObjectSize(1024);
        expect(valueObject).toBeInstanceOf(ValueObjectSize);
        expect(valueObject.value).toBe(1024);
    });

    it('should throw an error when value is null and nullable is false', () => {
        expect(() => new ValueObjectSize(null, false)).toThrow('size: The value cannot be null');
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectSize(null, true)).not.toThrow();
    });

    it('should throw an error when value is not a number', () => {
        expect(() => new ValueObjectSize('no-number')).toThrow(InvalidArgumentError);
    });

    it('should throw an error when value is negative', () => {
        expect(() => new ValueObjectSize(-1)).toThrow(InvalidArgumentError);
    });
});

describe('ValueObjectURL Tests', () => {
    it('should create a ValueObjectURL with a valid URL', () => {
        const valueObject = new ValueObjectURL('https://example.com');
        expect(valueObject).toBeInstanceOf(ValueObjectURL);
        expect(valueObject.value).toBe('https://example.com');
    });

    it('should throw an error when value exceeds maximum length', () => {
        const longValue = 'https://example.com/' + 'A'.repeat(990);
        expect(() => new ValueObjectURL(longValue)).toThrow('url: The value must be at most 1000 characters long');
    });

    it('should throw an error when value is null and nullable is false', () => {
        expect(() => new ValueObjectURL(null, false)).toThrow('url: The value cannot be null');
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectURL(null, true)).not.toThrow();
    });

    it('should throw an error when value is not a string', () => {
        expect(() => new ValueObjectURL(123)).toThrow('url: The value must be a string');
    });
});
