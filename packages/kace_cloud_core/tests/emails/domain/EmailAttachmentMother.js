import { v4 as uuidV4 } from 'uuid';

export class EmailAttachmentMother {
    static dto(overrides = {}) {
        return {
            id: uuidV4(),
            email_id: uuidV4(),
            url: 'https://s3.amazonaws.com/bucket/file.pdf',
            size: 1024,
            filename: 'file.pdf',
            created_at: new Date().toISOString(),
            created_by: uuidV4(),
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            ...overrides,
        };
    }
}
