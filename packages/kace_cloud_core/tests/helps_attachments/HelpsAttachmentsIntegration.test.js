import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import HelpsAttachmentsMother from './domain/HelpsAttachmentsMother.js';
import {
    HelpsAttachmentsCollectionResponse,
    HelpsAttachmentsCreator,
    HelpsAttachmentsDeleter,
    HelpsAttachmentsFinder,
    KnexHelpsAttachmentsRepository,
    HelpsAttachmentsSearcher,
} from '../../src/helps_attachments/index.js';

describe('Helps tests', () => {
    const repository = new KnexHelpsAttachmentsRepository(knexConfig);

    it('should create a new Help Attachment instance', async () => {
        const dto = HelpsAttachmentsMother.dto();
        dto.allowed_file_extensions = [dto.path.slice(dto.path.lastIndexOf('.'))];
        const helpAttachmentCreator = new HelpsAttachmentsCreator(repository);
        const createdAttachment = await helpAttachmentCreator.execute(dto);
        const result = await repository.connection('helps_attachments').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
        expect(createdAttachment.id.value).toBe(result[0].id);
    });

    it('should create a Help Attachment when the file extension case differs from allowed_file_extensions', async () => {
        const dto = { ...HelpsAttachmentsMother.dto(), path: 'PICTURE.PNG' };
        dto.allowed_file_extensions = ['.png'];
        const helpAttachmentCreator = new HelpsAttachmentsCreator(repository);

        const createdAttachment = await helpAttachmentCreator.execute(dto);

        const result = await repository.connection('helps_attachments').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
        expect(createdAttachment.id.value).toBe(result[0].id);
    });

    it('should create a Help Attachment when the allowed_file_extensions config is uppercase and the file extension is lowercase', async () => {
        const dto = { ...HelpsAttachmentsMother.dto(), path: 'picture.png' };
        dto.allowed_file_extensions = ['.PNG'];
        const helpAttachmentCreator = new HelpsAttachmentsCreator(repository);

        const createdAttachment = await helpAttachmentCreator.execute(dto);

        const result = await repository.connection('helps_attachments').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
        expect(createdAttachment.id.value).toBe(result[0].id);
    });

    it('should throw an error when the file extension is not in allowed_file_extensions regardless of case', async () => {
        const dto = { ...HelpsAttachmentsMother.dto(), path: 'PICTURE.EXE' };
        dto.allowed_file_extensions = ['.pdf', '.png', '.jpg', '.jpeg'];
        const helpAttachmentCreator = new HelpsAttachmentsCreator(repository);

        await expect(helpAttachmentCreator.execute(dto)).rejects.toThrow('This file extension is not allowed');
    });

    it('should return null if no Help record is found', async () => {
        await expect(new HelpsAttachmentsFinder(repository).execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should find an existing Help Attachment instance by id', async () => {
        const helpsAttachment = await HelpsAttachmentsMother.createHelpAttachment(repository);
        const helpAttachmentFinder = new HelpsAttachmentsFinder(repository);

        const response = await helpAttachmentFinder.execute(helpsAttachment.id.value);

        const jsonResponse = response.toJson().data;

        expect(jsonResponse.id).toBe(helpsAttachment.id.value);
    });

    it('should delete an existing Help Attachment instance', async () => {
        const helpAttachment = await HelpsAttachmentsMother.createHelpAttachment(repository);
        const helpAttachmentDeleter = new HelpsAttachmentsDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await helpAttachmentDeleter.execute(helpAttachment.id.value, deleteDto);

        await expect(new HelpsAttachmentsFinder(repository).execute(helpAttachment.id.value)).rejects.toThrow(
            CustomError
        );
    });

    it('should search for Help Attachment instances with given criteria', async () => {
        for (let i = 0; i < 2; i++) {
            await HelpsAttachmentsMother.createHelpAttachment(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const helpAttachmentSearcher = new HelpsAttachmentsSearcher(repository);

        const response = await helpAttachmentSearcher.execute(dtoCriteria);

        expect(response).toBeInstanceOf(HelpsAttachmentsCollectionResponse);
    });
});
