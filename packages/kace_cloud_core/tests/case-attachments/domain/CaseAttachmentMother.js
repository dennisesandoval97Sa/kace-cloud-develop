import { v4 as uuidv4 } from 'uuid';
import { CaseAttachment } from '../../../src/case-attachments';

export default class CaseAttachmentMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `CaseAttachment` entity.
     *
     * @returns {Object} The DTO containing the properties for a `CaseAttachment` entity.
     */
    static dto({
        id,
        case_id,
        description,
        size,
        path,
        type,
        is_active,
        attachment_type,
        created_at,
        created_by,
        allowed_file_extensions,
    } = {}) {
        return {
            id: id ?? uuidv4(),
            case_id: case_id ?? uuidv4(),
            description: description ?? 'Default attachment description',
            size: size ?? Math.floor(Math.random() * 100000),
            path: path ?? 'https://s3pruebaskase.s3.amazonaws.com/default/path/attachment.pdf',
            type: type ?? 1,
            is_active: is_active ?? true,
            attachment_type: attachment_type ?? null,
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
            allowed_file_extensions: allowed_file_extensions ?? ['.pdf', '.png', '.jpg', '.jpeg'],
        };
    }

    /**
     * Creates a `CaseAttachment` instance and saves it to the repository.
     *
     * @param {KnexCaseAttachmentRepository} repository - The repository to save the `CaseAttachment` instance.
     * @returns {CaseAttachment} The created `CaseAttachment` instance.
     */
    static async create(repository, data = {}) {
        const caseAttachment = CaseAttachment.create(CaseAttachmentMother.dto(data));
        await repository.save(caseAttachment);
        return caseAttachment;
    }
}
