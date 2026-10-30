import { randomUUID } from 'node:crypto';
import { QuickLink } from '../../../src/quick-links/domain/QuickLink.js';

export class QuickLinkMother {
    static dto(overrides = {}) {
        return {
            id: randomUUID(),
            title: 'Documentación KACE',
            url: 'https://example.com/documentacion',
            position: 0,
            created_at: new Date(),
            created_by: randomUUID(),
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            ...overrides,
        };
    }

    static create(overrides = {}) {
        return QuickLink.create(this.dto(overrides));
    }
}
