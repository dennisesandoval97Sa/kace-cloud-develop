import {
    TemplateAttachment,
    TemplateAttachmentCreator,
    TemplateAttachmentResponse,
    TemplateAttachmentCollectionResponse,
} from '../../src/template-attachments';
import { v4 as uuidv4 } from 'uuid';
import TemplateAttachmentMother from './domain/TemplateAttachmentMother';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { SQL_BLACKLIST_WORD_DETECTED, TEMPLATE_ATTACHMENT_EXTENSION_NOT_ALLOWED } from '@kace/error-codes';

describe('TemplateAttachment Entity', () => {
    const dto = TemplateAttachmentMother.dto();

    it('should create a TemplateAttachment with valid data', () => {
        const templateAttachment = TemplateAttachment.create(dto);
        expect(templateAttachment.id.value).toBe(dto.id);
        expect(templateAttachment.path.value).toBe(dto.path);
        expect(templateAttachment.type.value).toBe(dto.type);
        expect(templateAttachment.is_active.value).toBe(dto.is_active);
        expect(templateAttachment.created_by.value).toBe(dto.created_by);
        expect(templateAttachment.created_at.value).toBe(dto.created_at);
    });

    it('should update TemplateAttachment data', () => {
        const templateAttachment = TemplateAttachment.create(dto);
        const newData = {
            path: 'prueba.txt',
            type: 'image/jpg',
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        templateAttachment.path = newData.path;
        templateAttachment.type = newData.type;
        templateAttachment.is_active = newData.is_active;
        templateAttachment.updated_at = newData.updated_at;
        templateAttachment.updated_by = newData.updated_by;
        expect(templateAttachment.path.value).toBe(newData.path);
        expect(templateAttachment.type.value).toBe(newData.type);
        expect(templateAttachment.is_active.value).toBe(newData.is_active);
        expect(templateAttachment.changedAttributes).toEqual(newData);
    });

    it('defaults usage_type to "attachment" and tracks changes when set', () => {
        const templateAttachment = TemplateAttachment.create(dto);
        // Must never default to null/undefined: the attachments list filters with
        // `usage_type != 'inline'`, and standard SQL silently excludes NULL rows from
        // a `!=` comparison instead of matching them.
        expect(templateAttachment.usage_type).toBe('attachment');

        templateAttachment.usage_type = 'inline';
        expect(templateAttachment.usage_type).toBe('inline');
        expect(templateAttachment.changedAttributes.usage_type).toBe('inline');
    });

    it('normalizes usage_type undefined back to the "attachment" default', () => {
        const templateAttachment = TemplateAttachment.create(dto);
        templateAttachment.usage_type = 'inline';

        templateAttachment.usage_type = undefined;
        expect(templateAttachment.usage_type).toBe('attachment');
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => TemplateAttachment.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('tags SQL blacklist validation errors with the public error code', () => {
        const invalidData = TemplateAttachmentMother.dto({
            path: "invoice'; SELECT FROM users; --.pdf",
        });

        // El SQLInjectionGuard solo bloquea en modo enforce, y la corrida hereda
        // SQL_GUARD_MODE=observe del .env de la raiz que carga jest.config.js.
        // Este test describe el modo enforce, asi que lo fija el mismo en vez de
        // depender del entorno ambiente.
        const previousGuardMode = process.env.SQL_GUARD_MODE;
        process.env.SQL_GUARD_MODE = 'enforce';

        let error;
        try {
            TemplateAttachment.create(invalidData);
        } catch (caughtError) {
            error = caughtError;
        } finally {
            if (previousGuardMode === undefined) {
                delete process.env.SQL_GUARD_MODE;
            } else {
                process.env.SQL_GUARD_MODE = previousGuardMode;
            }
        }

        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.publicErrorCode).toBe(SQL_BLACKLIST_WORD_DETECTED);
    });

    it('tags disallowed extension errors with the public error code', async () => {
        const creator = new TemplateAttachmentCreator({});
        const invalidData = {
            ...TemplateAttachmentMother.dto({ path: 'invoice.exe' }),
            allowed_file_extensions: ['.pdf'],
        };

        await expect(creator.execute(invalidData)).rejects.toMatchObject({
            publicErrorCode: TEMPLATE_ATTACHMENT_EXTENSION_NOT_ALLOWED,
        });
    });

    it('rejects extensionless filenames even when the final character is allowed', async () => {
        const creator = new TemplateAttachmentCreator({});
        const invalidData = {
            ...TemplateAttachmentMother.dto({ path: 'invoice' }),
            allowed_file_extensions: ['e'],
        };

        await expect(creator.execute(invalidData)).rejects.toMatchObject({
            publicErrorCode: TEMPLATE_ATTACHMENT_EXTENSION_NOT_ALLOWED,
        });
    });

    it('does not update properties when values are the same', () => {
        const templateAttachment = TemplateAttachment.create(dto);
        const sameData = { ...dto };

        templateAttachment.path = sameData.path;
        templateAttachment.type = sameData.type;
        templateAttachment.is_active = sameData.is_active;

        expect(templateAttachment.changedAttributes).toEqual({});
    });

    it('marks a TemplateAttachment instance as deleted', () => {
        const templateAttachment = TemplateAttachment.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        templateAttachment.deleted_at = deleteDto.deleted_at;
        templateAttachment.deleted_by = deleteDto.deleted_by;

        expect(templateAttachment.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(templateAttachment.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const templateAttachment = TemplateAttachment.create(dto);
        const deleteDto = {};
        templateAttachment.deleted_at = null;
        templateAttachment.deleted_by = undefined;

        expect(templateAttachment.deleted_at.value).toBeNull();
        expect(templateAttachment.deleted_by.value).toBeUndefined();
    });

    it('flushes changes in TemplateAttachment instance', () => {
        const templateAttachment = TemplateAttachment.create(dto);
        const updateDto = {
            path: 'prueba.txt',
            type: 'image/png',
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        templateAttachment.path = updateDto.path;
        templateAttachment.type = updateDto.type;
        templateAttachment.is_active = updateDto.is_active;
        templateAttachment.updated_at = updateDto.updated_at;
        templateAttachment.updated_by = updateDto.updated_by;
        templateAttachment.flushChanges();

        expect(templateAttachment.changedAttributes).toEqual({});
    });
});

describe('TemplateAttachment Response Tests', () => {
    it('converts TemplateAttachment object to JSON representation', () => {
        const templateAttachment = TemplateAttachment.create(TemplateAttachmentMother.dto());
        const templateAttachmentResponse = new TemplateAttachmentResponse(templateAttachment);

        const json = templateAttachmentResponse.toJson();

        expect(json).toEqual({
            data: {
                id: templateAttachment.id.value,
                template_id: templateAttachment.template_id.value,
                path: templateAttachment.path.value,
                type: templateAttachment.type.value,
                is_active: templateAttachment.is_active.value,
                created_at: templateAttachment.created_at.value,
                updated_at: templateAttachment.updated_at.value,
                created_by: templateAttachment.created_by.value,
                updated_by: templateAttachment.updated_by.value,
            },
        });
    });

    it('returns an empty object if TemplateAttachment is not provided', () => {
        const templateAttachmentResponse = new TemplateAttachmentResponse(null);
        expect(templateAttachmentResponse.toJson()).toEqual({});
    });
});

describe('TemplateAttachment Collection Response Tests', () => {
    it('converts TemplateAttachment collection to JSON representation', () => {
        const templateAttachmentCollection = [
            TemplateAttachment.create(TemplateAttachmentMother.dto()),
            TemplateAttachment.create(TemplateAttachmentMother.dto()),
        ];
        const templateAttachmentCollectionResponse = new TemplateAttachmentCollectionResponse(
            templateAttachmentCollection,
            templateAttachmentCollection.length
        );

        const json = templateAttachmentCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: templateAttachmentCollection.map(
                    (templateAttachment) => new TemplateAttachmentResponse(templateAttachment).toJson().data
                ),
            },
            metadata: {
                count: templateAttachmentCollection.length,
            },
        });
    });
});
