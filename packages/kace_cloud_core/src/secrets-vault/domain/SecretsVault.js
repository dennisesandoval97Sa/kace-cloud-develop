import { AggregateRoot } from '../../shared/domain/AggregateRoot';
import { ValueObjectDescription, ValueObjectReference, ValueObjectSecret } from '../index';
import { Crypto } from '../../shared/domain/crypto/index.js';
import { TenantContext, ValueObjectBoolean } from "../../shared/index.js";

export class SecretsVault extends AggregateRoot {
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #descripcion;
    /** @type {ValueObjectReference} is initialized in the constructor */
    #referencia;
    /** @type {ValueObjectSecret} is initialized in the constructor */
    #secreto;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #password_encryption_migrated;
    /** @type {Crypto} is initialized in the constructor */
    #cryptoTool;

    constructor(dto) {
        super(dto.id);
        this.#descripcion = new ValueObjectDescription('Description', dto.descripcion, true);
        this.#referencia = new ValueObjectReference('Referencia', dto.referencia ?? 'DEFAULT');
        this.#secreto = new ValueObjectSecret('Secret', dto.secreto ?? 'default');
        this.#password_encryption_migrated = new ValueObjectBoolean('password_encryption_migrated', dto.password_encryption_migrated, true);
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;

        const tenant = TenantContext.getTenant();
        this.#cryptoTool = new Crypto(
            tenant.secret_iv.value,
            tenant.secret_key.value,
            tenant.encryption_method.value
        );
    }

    static create(dto) {
        return new SecretsVault(dto);
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        this.#descripcion = new ValueObjectDescription('description', value);
        this.changedAttributes.descripcion = this.#descripcion.value;
    }

    get referencia() {
        return this.#referencia;
    }

    set referencia(value) {
        this.#referencia = new ValueObjectReference('referencia', value);
        this.changedAttributes.referencia = this.#referencia.value;
    }

    get secreto() {
        return this.#secreto;
    }

    set secreto(value) {
        this.#secreto = new ValueObjectSecret('secreto', value);
        this.changedAttributes.secreto = this.#secreto.value;
    }

    get password_encryption_migrated() {
        return this.#password_encryption_migrated;
    }

    set password_encryption_migrated(value) {
        this.#password_encryption_migrated = new ValueObjectBoolean('password_encryption_migrated', value);
        this.changedAttributes.password_encryption_migrated = this.#password_encryption_migrated.value;
    }

    decryptSecret() {
        return this.#cryptoTool.decryptData(this.#secreto.value);
    }
}
