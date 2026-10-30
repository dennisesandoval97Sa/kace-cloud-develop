import { v4 as uuidv4 } from 'uuid';
import { TemplateAttachment } from '../../../src/template-attachments';

export default class TemplateAttachmentMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `TemplateAttachment` entity.
     *
     * @returns {Object} The DTO containing the properties for a `TemplateAttachment` entity.
     */
    static dto({ id, template_id, type, path, is_active, usage_type, created_at, created_by } = {}) {
        return {
            id: id ?? uuidv4(),
            template_id: template_id ?? uuidv4(),
            type: type ?? 'image/png',
            path: path ?? 'attachment.pdf',
            is_active: is_active ?? true,
            usage_type: usage_type ?? null,
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
        };
    }

    /**
     * Creates a `TemplateAttachment` instance and saves it to the repository.
     *
     * @param {KnexTemplateAttachmentRepository} repository - The repository to save the `TemplateAttachment` instance.
     * @returns {TemplateAttachment} The created `TemplateAttachment` instance.
     */
    static async create(repository, data = {}) {
        const templateAttachment = TemplateAttachment.create(TemplateAttachmentMother.dto(data));
        await repository.save(templateAttachment);
        return templateAttachment;
    }
}
