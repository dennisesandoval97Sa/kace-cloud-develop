import { v4 as uuidv4 } from 'uuid';
import { HelpsAttachments } from '../../../src/helps_attachments';
export default class HelpsAttachmentsMother {
    static dto() {
        return {
            id: uuidv4(),
            path: 'picture.png',
            tipo: 'image/png',
            help_id: uuidv4(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static async createHelpAttachment(repository) {
        const HelpsAttachment = HelpsAttachments.create(HelpsAttachmentsMother.dto());
        await repository.save(HelpsAttachment);
        return HelpsAttachment;
    }
}
