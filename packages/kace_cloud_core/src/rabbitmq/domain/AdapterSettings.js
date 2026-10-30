import { ValueObjectName } from './value-objects/ValueObjectName.js';
import { ValueObjectHost } from './value-objects/ValueObjectHost.js';
import { ValueObjectString } from './value-objects/ValueObjectString.js';
import { ValueObjectUuid, CustomError, ValueObjectBoolean } from '../../shared/index.js';

export class AdapterSettings {
    /**
     * @type {string} private id (uuid)
     */
    #id;

    /**
     * @type {string} private name
     */
    #name;

    /**
     * @type {string} private host
     */
    #host;

    /**
     * @type {number} private port
     */
    #port;

    /**
     * @type {string} private queue
     */
    #queue;

    /**
     * @type {string|null} private exchange
     */
    #exchange;

    /**
     * @type {string|null} private vhost
     */
    #vhost;

    /**
     * @type {string|null} private username
     */
    #username;

    /**
     * @type {string|null} private password
     */
    #password;

    /**
     * @type {ValueObjectBoolean} private password_encryption_migrated
     */
    #password_encryption_migrated;

    /**
     * @type {string|null} private created_at
     */
    #created_at;

    /**
     * @type {string|null} private updated_at
     */
    #updated_at;

    /**
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.name
     * @param {string} params.host
     * @param {number} params.port
     * @param {string} params.queue
     * @param {string|null} params.exchange
     * @param {string|null} params.vhost
     * @param {string|null} params.username
     * @param {string|null} params.password
     * @param {boolean} params.password_encryption_migrated
     * @param {string|null} params.created_at
     * @param {string|null} params.updated_at
     */
    constructor({
        id,
        name,
        host,
        port = 5672,
        queue,
        exchange = null,
        vhost = null,
        username = null,
        password = null,
        password_encryption_migrated,
        created_at = null,
        updated_at = null,
    }) {
        if (id !== undefined && id !== null) {
            this.#id = new ValueObjectUuid('id', id).value;
        } else {
            this.#id = null;
        }

        this.#name = new ValueObjectName(name).value;
        this.#host = new ValueObjectHost(host).value;
        this.#port = port;
        this.#queue = new ValueObjectString('queue', queue).value;
        this.#exchange = exchange === null ? null : new ValueObjectString('exchange', exchange, true).value;
        this.#vhost = vhost === null ? null : new ValueObjectString('vhost', vhost, true).value;
        this.#username = username === null ? null : new ValueObjectString('username', username, true).value;
        this.#password = password === null ? null : new ValueObjectString('password', password, true).value;
        this.#password_encryption_migrated = new ValueObjectBoolean(
            'password_encryption_migrated',
            password_encryption_migrated,
            true
        );
        this.#created_at = created_at;
        this.#updated_at = updated_at;
    }

    static create(dto) {
        if (!dto) throw new CustomError('AdapterSettings invalid: dto is required');
        return new AdapterSettings(dto);
    }

    get id() {
        return this.#id;
    }

    get name() {
        return this.#name;
    }

    get host() {
        return this.#host;
    }

    get port() {
        return this.#port;
    }

    get queue() {
        return this.#queue;
    }

    get exchange() {
        return this.#exchange;
    }

    get vhost() {
        return this.#vhost;
    }

    get username() {
        return this.#username;
    }

    get password() {
        return this.#password;
    }

    get password_encryption_migrated() {
        return this.#password_encryption_migrated;
    }

    get created_at() {
        return this.#created_at;
    }

    get updated_at() {
        return this.#updated_at;
    }
}
