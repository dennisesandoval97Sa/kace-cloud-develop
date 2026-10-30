import { AggregateRoot } from '../../shared/index.js';

/**
 * Value Object que valida el título del enlace rápido.
 */
export class QuickLinkTitle {
    constructor(value) {
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error('El título es obligatorio');
        }

        const title = value.trim();

        if (title.length > 100) {
            throw new Error('El título no puede superar 100 caracteres');
        }

        this.value = title;
    }
}

/**
 * Value Object que valida la URL del enlace rápido.
 */
export class QuickLinkUrl {
    constructor(value) {
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error('La URL es obligatoria');
        }

        const url = value.trim();

        if (url.length > 500) {
            throw new Error('La URL no puede superar 500 caracteres');
        }

        try {
            const parsed = new URL(url);

            if (!['http:', 'https:'].includes(parsed.protocol)) {
                throw new Error('Protocolo inválido');
            }

            if (!parsed.hostname) {
                throw new Error('Dominio inválido');
            }
        } catch {
            throw new Error('La URL debe ser válida y utilizar HTTP o HTTPS');
        }

        this.value = url;
    }
}

/**
 * Value Object que valida la posición.
 *
 * La posición puede ser null cuando todavía no ha sido
 * calculada por el caso de uso de creación.
 */
export class QuickLinkPosition {
    constructor(value) {
        if (value === undefined || value === null) {
            this.value = null;
            return;
        }

        if (!Number.isInteger(value) || value < 0) {
            throw new Error('La posición debe ser un entero mayor o igual a cero');
        }

        this.value = value;
    }
}

/**
 * Agregado de dominio QuickLink.
 *
 * Sigue el patrón del agregado Ans y utiliza AggregateRoot
 * para manejar el identificador, auditoría y borrado lógico.
 */
export class QuickLink extends AggregateRoot {
    /** @type {QuickLinkTitle} */
    #title;

    /** @type {QuickLinkUrl} */
    #url;

    /** @type {QuickLinkPosition} */
    #position;

    /**
     * Crea una instancia del agregado QuickLink.
     *
     * @param {Object} dto
     * @returns {QuickLink}
     */
    static create(dto) {
        return new QuickLink(dto);
    }

    /**
     * Construye el agregado a partir de los datos recibidos.
     *
     * @param {Object} dto
     */
    constructor(dto) {
        super(dto.id);

        this.#title = new QuickLinkTitle(dto.title);
        this.#url = new QuickLinkUrl(dto.url);
        this.#position = new QuickLinkPosition(dto.position);

        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at ?? null;
        this.updated_by = dto.updated_by ?? null;
        this.deleted_at = dto.deleted_at ?? null;
        this.deleted_by = dto.deleted_by ?? null;
    }

    /**
     * Obtiene el título del enlace.
     *
     * @returns {QuickLinkTitle}
     */
    get title() {
        return this.#title;
    }

    /**
     * Actualiza el título y registra el cambio.
     *
     * @param {string} value
     */
    set title(value) {
        this.#title = new QuickLinkTitle(value);
        this.changedAttributes.title = this.#title.value;
    }

    /**
     * Obtiene la URL.
     *
     * @returns {QuickLinkUrl}
     */
    get url() {
        return this.#url;
    }

    /**
     * Actualiza la URL y registra el cambio.
     *
     * @param {string} value
     */
    set url(value) {
        this.#url = new QuickLinkUrl(value);
        this.changedAttributes.url = this.#url.value;
    }

    /**
     * Obtiene la posición.
     *
     * @returns {QuickLinkPosition}
     */
    get position() {
        return this.#position;
    }

    /**
     * Actualiza la posición y registra el cambio.
     *
     * @param {number} value
     */
    set position(value) {
        this.#position = new QuickLinkPosition(value);
        this.changedAttributes.position = this.#position.value;
    }

    /**
     * Convierte el agregado en un objeto plano para
     * su persistencia en PostgreSQL.
     *
     * @returns {Object}
     */
    toPrimitives() {
        return {
            id: this.id.value,
            title: this.#title.value,
            url: this.#url.value,
            position: this.#position.value,
            created_at: this.created_at?.value ?? null,
            created_by: this.created_by?.value ?? null,
            updated_at: this.updated_at?.value ?? null,
            updated_by: this.updated_by?.value ?? null,
            deleted_at: this.deleted_at?.value ?? null,
            deleted_by: this.deleted_by?.value ?? null,
        };
    }
}
