import { AggregateRoot, InvalidArgumentError, ValueObjectBoolean, ValueObjectDescription } from '../../shared';
import { ValueObjectCertificate } from './ValueObjectCertificate';
import { ValueObjectConnection } from './ValueObjectConnection';

export class AllowedConnection extends AggregateRoot {
    static #CERTIFICATE_REQUIRED_MESSAGE = 'certificate: The value cannot be null when HTTPS is enabled';
    static #CERTIFICATE_FORBIDDEN_MESSAGE = 'certificate: The value must be empty when HTTPS is disabled';

    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;
    /** @type {ValueObjectConnection} is initialized in the constructor */
    #connection;
    /** @type {ValueObjectCertificate} is initialized in the constructor */
    #certificate;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #has_ssl;

    constructor({
        id,
        description,
        connection,
        certificate,
        is_active,
        has_ssl,
        created_at,
        created_by,
        updated_at = null,
        updated_by = null,
        deleted_at = null,
        deleted_by = null,
    }) {
        super(id);
        this.#description = new ValueObjectDescription('description', description ?? 'defalut');
        this.#connection = new ValueObjectConnection('connection', connection ?? 'defalut');
        this.#certificate = new ValueObjectCertificate('certificate', certificate, true);
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.#has_ssl = new ValueObjectBoolean('has_ssl', has_ssl ?? false);
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (this.#description.value !== value) {
            this.#description = new ValueObjectDescription('description', value);
            this.changedAttributes.description = value;
        }
    }

    get connection() {
        return this.#connection;
    }

    set connection(value) {
        if (this.#connection.value !== value) {
            this.#connection = new ValueObjectConnection('connection', value);
            this.changedAttributes.connection = value;
        }
    }

    get certificate() {
        return this.#certificate;
    }

    set certificate(value) {
        AllowedConnection.#ensureCertificateMatchesHttps(this.#has_ssl.value, value);
        if (this.#certificate.value !== value) {
            this.#certificate = new ValueObjectCertificate('certificate', value, true);
            this.changedAttributes.certificate = value;
        }
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectBoolean('is_active', value);
            this.changedAttributes.is_active = value;
        }
    }

    get has_ssl() {
        return this.#has_ssl;
    }

    set has_ssl(value) {
        AllowedConnection.#ensureCertificateMatchesHttps(value, this.#certificate.value);
        if (this.#has_ssl.value !== value) {
            this.#has_ssl = new ValueObjectBoolean('has_ssl', value);
            this.changedAttributes.has_ssl = value;
        }
    }

    update(dto) {
        const updatesCertificate = Object.prototype.hasOwnProperty.call(dto, 'certificate');
        const updatesHttps = Object.prototype.hasOwnProperty.call(dto, 'has_ssl');
        const nextCertificate = updatesCertificate ? dto.certificate : this.#certificate.value;
        const nextHttps = updatesHttps ? dto.has_ssl : this.#has_ssl.value;

        AllowedConnection.#ensureCertificateMatchesHttps(nextHttps, nextCertificate);

        const candidate = new AllowedConnection(this.toJson());
        candidate.#applyUpdate(dto, nextCertificate, nextHttps, updatesCertificate, updatesHttps);
        this.#applyUpdate(dto, nextCertificate, nextHttps, updatesCertificate, updatesHttps);
    }

    #applyUpdate(dto, nextCertificate, nextHttps, updatesCertificate, updatesHttps) {
        const otherFields = { ...dto };
        delete otherFields.certificate;
        delete otherFields.has_ssl;
        super.update(otherFields);

        if (updatesCertificate && this.#certificate.value !== nextCertificate) {
            this.#certificate = new ValueObjectCertificate('certificate', nextCertificate, true);
            this.changedAttributes.certificate = nextCertificate;
        }

        if (updatesHttps && this.#has_ssl.value !== nextHttps) {
            this.#has_ssl = new ValueObjectBoolean('has_ssl', nextHttps);
            this.changedAttributes.has_ssl = nextHttps;
        }
    }

    static #isHttpsEnabled(value) {
        return value === true || value === 1;
    }

    static #ensureCertificateMatchesHttps(hasSsl, certificate) {
        const certificateIsEmpty = certificate === null || certificate === undefined || certificate === '';

        if (AllowedConnection.#isHttpsEnabled(hasSsl) && certificateIsEmpty) {
            throw new InvalidArgumentError(AllowedConnection.#CERTIFICATE_REQUIRED_MESSAGE);
        }

        if (!AllowedConnection.#isHttpsEnabled(hasSsl) && !certificateIsEmpty) {
            throw new InvalidArgumentError(AllowedConnection.#CERTIFICATE_FORBIDDEN_MESSAGE);
        }
    }

    static create(dto) {
        AllowedConnection.#ensureCertificateMatchesHttps(dto.has_ssl ?? false, dto.certificate);
        return new AllowedConnection(dto);
    }
}
