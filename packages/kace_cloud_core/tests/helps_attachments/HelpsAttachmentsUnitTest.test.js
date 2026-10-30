import { v4 as uuidv4 } from 'uuid';
import { HelpsAttachments, HelpsAttachmentsResponse } from '../../src/helps_attachments';
import HelpsAttachmentsMother from './domain/HelpsAttachmentsMother';
import { UuidError } from '../../src/shared/errors/UuidError';

describe('Helps Attachments test', () => {
    it('should return a Help Attachment instance', () => {
        const dto = HelpsAttachmentsMother.dto();
        const helpAttachments = HelpsAttachments.create(dto);

        expect(helpAttachments).toBeInstanceOf(HelpsAttachments);
        expect(helpAttachments.id.value).toEqual(dto.id);
        expect(helpAttachments.path.value).toEqual(dto.path);
        expect(helpAttachments.tipo.value).toEqual(dto.tipo);
        expect(helpAttachments.created_at.value).toEqual(dto.created_at);
        expect(helpAttachments.created_by.value).toEqual(dto.created_by);
    });

    it('should delete a Help Attachment instance', () => {
        const dto = HelpsAttachmentsMother.dto();
        const helpAttachment = HelpsAttachments.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        helpAttachment.delete(deleteDto);

        expect(helpAttachment.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(helpAttachment.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should throw an error with invalid UUID', () => {
        const dto = HelpsAttachmentsMother.dto();
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => HelpsAttachments.create(invalidData)).toThrow(UuidError);
    });
});

describe('Helps Attachment Responses Tests', () => {
    it('should convert a Help Attachments object to JSON representation', () => {
        const helpAttachments = new HelpsAttachments(HelpsAttachmentsMother.dto());
        const helpAttachmentsResponse = new HelpsAttachmentsResponse(helpAttachments);

        const json = helpAttachmentsResponse.toJson();

        expect(json).toMatchObject({
            data: {
                id: helpAttachments.id.value,
                path: helpAttachments.path.value,
                tipo: helpAttachments.tipo.value,
                created_at: helpAttachments.created_at.value,
                updated_at: helpAttachments.updated_at.value,
                created_by: helpAttachments.created_by.value,
                updated_by: helpAttachments.updated_by.value,
            },
        });
    });

    it('should return an empty object if Help is null', () => {
        const helpAttachmentsResponse = new HelpsAttachmentsResponse(null);

        const json = helpAttachmentsResponse.toJson();

        expect(json).toMatchObject({});
    });
});
