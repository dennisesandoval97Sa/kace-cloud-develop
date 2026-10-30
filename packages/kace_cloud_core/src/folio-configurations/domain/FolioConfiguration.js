import { AggregateRoot, ValueObjectDescription, ValueObjectStatus, ValueObjectString } from '../../shared/index.js';
import { ValidationFailError } from '../../shared/errors/ValidationFailError.js';
import { ValueObjectFolioSegments } from './ValueObjectFolioSegments.js';
import { FolioUniquenessPolicy } from './FolioUniquenessPolicy.js';
import { MAX_START_VALUE, OVERFLOW_POLICIES, RESET_POLICIES } from './segments/segmentCatalog.js';

export { OVERFLOW_POLICIES };

export class FolioConfiguration extends AggregateRoot {
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #nombre;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #descripcion;
    /** @type {ValueObjectFolioSegments} is initialized in the constructor */
    #segments;
    /** @type {string} is initialized in the constructor */
    #reset_policy;
    /** @type {number} is initialized in the constructor */
    #start_value;
    /** @type {string} is initialized in the constructor */
    #overflow_policy;
    /** @type {ValueObjectStatus} is initialized in the constructor */
    #status;

    constructor({
        id,
        nombre,
        descripcion,
        segments,
        reset_policy,
        start_value,
        overflow_policy,
        status,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#nombre = new ValueObjectDescription('nombre', nombre ?? 'default');
        // Optional: the Joi allows '' and null, and actionPreview builds a draft without one.
        // Not ValueObjectDescription: the shared one forwards `super(field, value)` without
        // its own `nullable`, so it throws on any falsy value whatever the caller asks for.
        // ValueObjectString honours the flag and still runs the type/SQLi/XSS guards.
        this.#descripcion = new ValueObjectString('descripcion', descripcion || null, true);
        this.#segments = new ValueObjectFolioSegments('segments', segments);
        this.#reset_policy = FolioConfiguration.#validateResetPolicy(reset_policy ?? 'never');
        this.#start_value = FolioConfiguration.#validateStartValue(start_value ?? 1);
        this.#overflow_policy = FolioConfiguration.#validateOverflowPolicy(overflow_policy ?? 'fail');
        this.#status = new ValueObjectStatus('status', status, true);
        this.#assertInvariants();

        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_at = updated_at ?? null;
        this.updated_by = updated_by ?? null;
        this.deleted_at = deleted_at ?? null;
        this.deleted_by = deleted_by ?? null;
    }

    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        if (this.#nombre.value !== value) {
            this.#nombre = new ValueObjectDescription('nombre', value);
            this.changedAttributes.nombre = value;
        }
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        const normalized = value || null;
        if (this.#descripcion.value !== normalized) {
            this.#descripcion = new ValueObjectString('descripcion', normalized, true);
            this.changedAttributes.descripcion = normalized;
        }
    }

    get segments() {
        return this.#segments;
    }

    set segments(value) {
        if (JSON.stringify(this.#segments.value) !== JSON.stringify(value)) {
            this.#segments = new ValueObjectFolioSegments('segments', value);
            this.changedAttributes.segments = value;
        }
    }

    get reset_policy() {
        return this.#reset_policy;
    }

    set reset_policy(value) {
        if (this.#reset_policy !== value) {
            this.#reset_policy = FolioConfiguration.#validateResetPolicy(value);
            this.changedAttributes.reset_policy = value;
        }
    }

    get start_value() {
        return this.#start_value;
    }

    set start_value(value) {
        if (this.#start_value !== value) {
            this.#start_value = FolioConfiguration.#validateStartValue(value);
            this.changedAttributes.start_value = value;
        }
    }

    get overflow_policy() {
        return this.#overflow_policy;
    }

    set overflow_policy(value) {
        if (this.#overflow_policy !== value) {
            this.#overflow_policy = FolioConfiguration.#validateOverflowPolicy(value);
            this.changedAttributes.overflow_policy = value;
        }
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        if (this.#status.value !== value) {
            this.#status = new ValueObjectStatus('status', value, true);
            this.changedAttributes.status = value;
        }
    }

    /**
     * Applies the dto and then checks the invariants that span several fields: each setter
     * only sees its own value, and a dto can change the segments and the policies at once.
     *
     * @param {Object} dto
     */
    update(dto) {
        super.update(dto);
        this.#assertInvariants();
    }

    /** The single place for cross-field invariants; the constructor and update() call it. */
    #assertInvariants() {
        const segments = this.#segments.value;
        const sequenceIndex = segments.findIndex((segment) => segment.type === 'sequence');

        // 'prefix' scopes the counter by whatever is rendered before the consecutive, so
        // there has to be something in front of it.
        if (this.#reset_policy === 'prefix' && sequenceIndex === 0) {
            throw new ValidationFailError(
                'reset_policy: "prefix" requiere al menos un segmento antes del consecutivo',
                'reset_policy'
            );
        }

        const sequence = segments[sequenceIndex];
        if (String(this.#start_value).length > sequence.length) {
            throw new ValidationFailError(
                `start_value: ${this.#start_value} no cabe en los ${sequence.length} dígitos del consecutivo`,
                'start_value'
            );
        }

        FolioUniquenessPolicy.assert({
            segments,
            resetPolicy: this.#reset_policy,
            overflowPolicy: this.#overflow_policy,
        });
    }

    static #validateResetPolicy(value) {
        if (!RESET_POLICIES.includes(value)) {
            throw new ValidationFailError(
                `reset_policy: "${value}" no válido. Permitidos: ${RESET_POLICIES.join(', ')}`,
                'reset_policy'
            );
        }
        return value;
    }

    static #validateStartValue(value) {
        if (!Number.isInteger(value) || value < 0 || value > MAX_START_VALUE) {
            throw new ValidationFailError(
                `start_value: debe ser un entero entre 0 y ${MAX_START_VALUE}`,
                'start_value'
            );
        }
        return value;
    }

    static #validateOverflowPolicy(value) {
        if (!OVERFLOW_POLICIES.includes(value)) {
            throw new ValidationFailError(
                `overflow_policy: "${value}" no válido. Permitidos: ${OVERFLOW_POLICIES.join(', ')}`,
                'overflow_policy'
            );
        }
        return value;
    }

    /**
     * @param {Object} dto
     * @returns {FolioConfiguration}
     */
    static create(dto) {
        return new FolioConfiguration(dto);
    }
}
