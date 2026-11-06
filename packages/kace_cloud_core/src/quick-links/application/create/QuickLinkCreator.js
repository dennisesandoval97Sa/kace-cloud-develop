import { randomUUID } from 'node:crypto';
import { QuickLink } from '../../domain/QuickLink.js';

/**
 * Caso de uso para crear enlaces rápidos.
 *
 * Sigue el patrón de AnsCreator: recibe el repositorio,
 * construye el agregado, valida y persiste.
 */
export class QuickLinkCreator {
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {Object} dto
     * @returns {Promise<QuickLink>}
     */
    async execute(dto) {
        const quickLink = QuickLink.create({
            id: randomUUID(),
            title: dto.title,
            url: dto.url,
            position: dto.position,
            created_at: dto.created_at ?? new Date(),
            created_by: dto.created_by,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        });

        await this.#repository.save(quickLink);

        return quickLink;
    }
}
