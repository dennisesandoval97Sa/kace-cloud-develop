import { ValueObjectPath } from '../../shared/domain/value-object/ValueObjectPath';
import { ValueObjectEmail } from './value-object/ValueObjectEmail';
import { ValueObjectTypes } from '../../shared/domain/value-object/ValueObjectTypes';
import { ValueObjectIncludeAttachments } from './value-object/ValueObjectIncludeAttachments';
import { AggregateRoot, ValueObjectDescription, ValueObjectStatus } from '../../shared';
import { ValueObjectBody } from './value-object/ValueObjectBody';
import { ValueObjectSubject } from './value-object/ValueObjectSubject';

export class Template extends AggregateRoot {
    /** @type {ValueObjectDescription} */
    #descripcion; // is initialized in the constructor

    /** @type {ValueObjectPath} is initialized in the constructor */
    #ruta;

    /** @type {ValueObjectTypes} is initialized in the constructor */
    #tipo;

    /** @type {ValueObjectEmail} is initialized in the constructor */
    #destinatario;

    /** @type {ValueObjectEmail} is initialized in the constructor */
    #copia;

    /** @type {ValueObjectEmail} is initialized in the constructor */
    #copia_oculta;

    /** @type {ValueObjectSubject} is initialized in the constructor */
    #asunto;

    /** @type {ValueObjectBody} is initialized in the constructor */
    #cuerpo;

    /** @type {ValueObjectIncludeAttachments} is initialized in the constructor */
    #incluye_adjuntos;

    /** @type {ValueObjectIncludeAttachments} is initialized in the constructor */
    #enviar_adjuntos_del_caso;

    /** @type {ValueObjectStatus} is initialized in the constructor */
    #status;

    /**
     * @param {Object} dto - Data transfer object containing the initial values.
     * @param {string} dto.id - Unique identifier (UUID).
     * @param {string} dto.descripcion - Description of the template.
     * @param {string|null} [dto.ruta] - Optional path associated with the template.
     * @param {string} dto.tipo - Type of template.
     * @param {string} dto.destinatario - Recipient of the template.
     * @param {string|null} [dto.copia] - Optional CC field.
     * @param {string|null} [dto.copia_oculta] - Optional BCC field.
     * @param {string} dto.asunto - Subject of the template.
     * @param {string} dto.cuerpo - Body content of the template.
     * @param {boolean} dto.incluye_adjuntos - Indicates if the template includes attachments.
     * @param {boolean} dto.enviar_adjuntos_del_caso - Indicates if case attachments should be sent with case emails.
     * @param {string} dto.status - Status of the template.
     * @param {string} dto.created_at - Timestamp of creation.
     * @param {string} dto.updated_at - Timestamp of last update.
     * @param {string|null} [dto.created_by] - UUID of the creator (nullable).
     * @param {string|null} [dto.updated_by] - UUID of the last updater (nullable).
     */
    constructor(dto) {
        super(dto.id);
        this.#descripcion = new ValueObjectDescription('descripcion', dto.descripcion ?? 'default');
        this.#ruta = new ValueObjectPath('ruta', dto.ruta, true);
        this.#tipo = new ValueObjectTypes('tipo', dto.tipo);
        this.#destinatario = new ValueObjectEmail('destinatario', dto.destinatario ?? 'default@default.com');
        this.#copia = new ValueObjectEmail('copia', dto.copia, true);
        this.#copia_oculta = new ValueObjectEmail('copia_oculta', dto.copia_oculta, true);
        this.#asunto = new ValueObjectSubject('asunto', dto.asunto ?? 'default');
        this.#cuerpo = new ValueObjectBody('cuerpo', dto.cuerpo ?? 'default');
        this.#incluye_adjuntos = new ValueObjectIncludeAttachments('incluye_adjuntos', dto.incluye_adjuntos, true);
        this.#enviar_adjuntos_del_caso = new ValueObjectIncludeAttachments(
            'enviar_adjuntos_del_caso',
            dto.enviar_adjuntos_del_caso ?? false,
            true
        );
        this.#status = new ValueObjectStatus('status', dto.status);

        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }
    /** @returns {ValueObjectString} */
    get descripcion() {
        return this.#descripcion;
    }

    /** @param {string} value */
    set descripcion(value) {
        this.#descripcion = new ValueObjectDescription('descripcion', value);
        this.changedAttributes.descripcion = this.#descripcion.value;
    }

    /** @returns {ValueObjectPath} */
    get ruta() {
        return this.#ruta;
    }

    /** @param {string|null} value */
    set ruta(value) {
        this.#ruta = new ValueObjectPath('ruta', value, true);
        this.changedAttributes.ruta = this.#ruta.value;
    }

    /** @returns {ValueObjectTypes} */
    get tipo() {
        return this.#tipo;
    }

    /** @param {string} value */
    set tipo(value) {
        this.#tipo = new ValueObjectTypes('tipo', value);
        this.changedAttributes.tipo = this.#tipo.value;
    }

    /** @returns {ValueObjectEmail} */
    get destinatario() {
        return this.#destinatario;
    }

    /** @param {string} value */
    set destinatario(value) {
        this.#destinatario = new ValueObjectEmail('destinatario', value);
        this.changedAttributes.destinatario = this.#destinatario.value;
    }

    /** @returns {ValueObjectEmail} */
    get copia() {
        return this.#copia;
    }

    /** @param {string|null} value */
    set copia(value) {
        this.#copia = new ValueObjectEmail('copia', value, true);
        this.changedAttributes.copia = this.#copia.value;
    }

    /** @returns {ValueObjectEmail} */
    get copia_oculta() {
        return this.#copia_oculta;
    }

    /** @param {string|null} value */
    set copia_oculta(value) {
        this.#copia_oculta = new ValueObjectEmail('copia_oculta', value, true);
        this.changedAttributes.copia_oculta = this.#copia_oculta.value;
    }

    /** @returns {ValueObjectSubject} */
    get asunto() {
        return this.#asunto;
    }

    /** @param {string} value */
    set asunto(value) {
        this.#asunto = new ValueObjectSubject('asunto', value);
        this.changedAttributes.asunto = this.#asunto.value;
    }

    /** @returns {ValueObjectBody} */
    get cuerpo() {
        return this.#cuerpo;
    }

    /** @param {string} value */
    set cuerpo(value) {
        this.#cuerpo = new ValueObjectBody('cuerpo', value);
        this.changedAttributes.cuerpo = this.#cuerpo.value;
    }

    /** @returns {ValueObjectIncludeAttachments} */
    get incluye_adjuntos() {
        return this.#incluye_adjuntos;
    }

    /** @param {boolean} value */
    set incluye_adjuntos(value) {
        this.#incluye_adjuntos = new ValueObjectIncludeAttachments('incluye_adjuntos', value, true);
        this.changedAttributes.incluye_adjuntos = this.#incluye_adjuntos.value;
    }

    /** @returns {ValueObjectIncludeAttachments} */
    get enviar_adjuntos_del_caso() {
        return this.#enviar_adjuntos_del_caso;
    }

    /** @param {boolean} value */
    set enviar_adjuntos_del_caso(value) {
        this.#enviar_adjuntos_del_caso = new ValueObjectIncludeAttachments(
            'enviar_adjuntos_del_caso',
            value ?? false,
            true
        );
        this.changedAttributes.enviar_adjuntos_del_caso = this.#enviar_adjuntos_del_caso.value;
    }

    /** @returns {ValueObjectStatus} */
    get status() {
        return this.#status;
    }

    /** @param {string} value */
    set status(value) {
        this.#status = new ValueObjectStatus('status', value);
        this.changedAttributes.status = this.#status.value;
    }

    /**
     * Creates a new Template object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the Template object.
     * @returns {Template} A new instance of the Template class.
     */
    static create(dto) {
        return new Template(dto);
    }
}
