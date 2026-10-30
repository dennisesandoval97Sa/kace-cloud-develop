import { ValueObjectInt } from '../../shared/domain/value-object/ValueObjectInt';
import { ValueObjectTimestamp } from '../../shared/domain/value-object/ValueObjectTimestamp';
import { ValueObjectJson } from '../../shared/domain/value-object/ValueObjectJson';
import { ValueObjectTypes } from './value-object/ValueObjectTypes';
import {
    AggregateRoot,
    DomainError,
    MailAccountsTypes,
    ValueObjectBoolean,
    ValueObjectEmail,
    ValueObjectName,
    ValueObjectStatus,
    ValueObjectString,
    ValueObjectVaultReference,
} from '../../shared';
import { ValueObjectDescription } from './value-object/ValueObjectDescription';
import { ValueObjectHost } from './value-object/ValueObjectHost';
import { ValueObjectPort } from './value-object/ValueObjectPort';
import { ValueObjectProtocol } from './value-object/ValueObjectProtocol';
import { ValueObjectEncryption } from './value-object/ValueObjectEncryption';
import { ValueObjectCode } from './value-object/ValueObjectCode';
import { ValueObjectToken } from './value-object/ValueObjectToken';
import { ValueObjectLoginEndpoint } from './value-object/ValueObjectLoginEndpoint';
import { ValueObjectFolders } from './value-object/ValueObjectFolders';
import { ValueObjectScope } from './value-object/ValueObjectScope';

export class MailAccount extends AggregateRoot {
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;
    /** @type {ValueObjectTypes} is initialized in the constructor */
    #type;
    /** @type {ValueObjectHost} is initialized in the constructor */
    #host;
    /** @type {ValueObjectPort} is initialized in the constructor */
    #port;
    /** @type {ValueObjectProtocol} is initialized in the constructor */
    #protocol;
    /** @type {ValueObjectEncryption} is initialized in the constructor */
    #encryption;
    /** @type {ValueObjectVaultReference} is initialized in the constructor */
    #username;
    /** @type {ValueObjectVaultReference} is initialized in the constructor */
    #password;
    /** @type {ValueObjectEmail} is initialized in the constructor */
    #from_address;
    /** @type {ValueObjectName} is initialized in the constructor */
    #from_name;
    /** @type {ValueObjectVaultReference} is initialized in the constructor */
    #tenant_id;
    /** @type {ValueObjectVaultReference} is initialized in the constructor */
    #client_id;
    /** @type {ValueObjectVaultReference} is initialized in the constructor */
    #client_secret;
    /** @type {ValueObjectCode} is initialized in the constructor */
    #code;
    /** @type {ValueObjectToken} is initialized in the constructor */
    #refresh_token;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #mails_download_limit;
    /** @type {ValueObjectLoginEndpoint} is initialized in the constructor */
    #login_endpoint;
    /** @type {ValueObjectScope} is initialized in the constructor */
    #graph_scope;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #start_syncing_from;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #last_synchronization;
    /** @type {ValueObjectFolders} is initialized in the constructor */
    #folders;
    /** @type {ValueObjectToken} is initialized in the constructor */
    #access_token;
    /** @type {ValueObjectEmail} is initialized in the constructor */
    #email_account;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #vault;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #vault_data;
    /** @type {ValueObjectStatus} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #register_in_channel_hub;

    /** @type {ValueObjectString} is initialized in the constructor */
    #channel_hub_connection_id;

    /** @type {ValueObjectJson} is initialized in the constructor */
    #channel_hub_error;

    get channel_hub_connection_id() {
        return this.#channel_hub_connection_id;
    }

    set channel_hub_connection_id(value) {
        if (this.#channel_hub_connection_id.value !== value) {
            this.#channel_hub_connection_id = new ValueObjectString('channel_hub_connection_id', value, true);
            this.changedAttributes.channel_hub_connection_id = value;
        }
    }

    get channel_hub_error() {
        return this.#channel_hub_error;
    }

    set channel_hub_error(value) {
        this.#channel_hub_error = new ValueObjectJson('channel_hub_error', value, true);
        this.changedAttributes.channel_hub_error = JSON.stringify(this.#channel_hub_error.value);
    }

    /**
     * @param {Object} dto - Data transfer object containing the initial values.
     * @param {string} dto.id - Unique identifier.
     * @param {string} dto.description - Description.
     * @param {String} dto.type - Type of the mail account
     * @param {String} dto.host - Host address of the mail server
     * @param {Number} dto.port - Port number for the mail server
     * @param {String} dto.protocol - Protocol used (e.g., IMAP, POP3, SMTP)
     * @param {String} dto.encryption - Encryption method (e.g., SSL, TLS)
     * @param {String} dto.username - Username for the mail account
     * @param {String} dto.password - Password for the mail account
     * @param {String} dto.from_address - Email address used in the "From" field
     * @param {String} dto.from_name - Name used in the "From" field
     * @param {String} dto.tenant_id - Tenant ID for multi-tenant applications
     * @param {String} dto.client_id - Client ID for OAuth authentication
     * @param {String} dto.client_secret - Client secret for OAuth authentication
     * @param {String} dto.code - Authorization code for OAuth
     * @param {String} dto.refresh_token - Refresh token for OAuth
     * @param {Number} dto.mails_download_limit - Limit for downloading emails
     * @param {String} dto.login_endpoint - Endpoint for logging in
     * @param {String} dto.graph_scope - Graph API scope for OAuth
     * @param {Date} dto.start_syncing_from - Start date for syncing emails
     * @param {Date} dto.last_synchronization - Date of the last synchronization
     * @param {Array} dto.folders - List of folders in the mail
     * @param {String} dto.access_token - Access token for OAuth
     * @param {String} dto.email_account - Email account
     * @param {String} dto.vault - Vault for storing sensitive information
     * @param {Object} dto.vault_data - Data stored in the vault
     * @param {boolean} dto.is_active - Is_active code.
     * @param {boolean} dto.register_in_channel_hub - Register in channel hub flag.
     * @param {string} dto.created_at - Timestamp of creation.
     * @param {string} dto.updated_at - Timestamp of last update.
     * @param {string} dto.created_by - UUID of the creator.
     * @param {string} dto.updated_by - UUID of the last updater.
     * @param {string} dto.deleted_at - Timestamp of deletion.
     * @param {string} dto.deleted_by - UUID of the deleter.
     * @param {string} dto.channel_hub_connection_id - UUID of the deleter.
     * @param {Object} dto.channel_hub_error - Channel Hub error information.
     */
    constructor(dto) {
        super(dto.id);
        this.#description = new ValueObjectDescription('description', dto.description ?? 'default');
        this.#type = new ValueObjectTypes('type', dto.type);
        this.#host = new ValueObjectHost('host', dto.host, true);
        this.#port = new ValueObjectPort('port', dto.port, true);
        this.#protocol = new ValueObjectProtocol('protocol', dto.protocol, true);
        this.#encryption = new ValueObjectEncryption('encryption', dto.encryption, true);
        this.#username = new ValueObjectVaultReference('username', dto.username, true);
        this.#password = new ValueObjectVaultReference('password', dto.password, true);
        this.#from_address = new ValueObjectEmail('from_address', dto.from_address, true);
        this.#from_name = new ValueObjectName('from_name', dto.from_name, true);
        this.#tenant_id = new ValueObjectVaultReference('tenant_id', dto.tenant_id, true);
        this.#client_id = new ValueObjectVaultReference('client_id', dto.client_id, true);
        this.#client_secret = new ValueObjectVaultReference('client_secret', dto.client_secret, true);
        this.#code = new ValueObjectCode('code', dto.code, true);
        this.#refresh_token = new ValueObjectToken('refresh_token', dto.refresh_token, true);
        this.#mails_download_limit = new ValueObjectInt('mails_download_limit', dto.mails_download_limit, true);
        this.#login_endpoint = new ValueObjectLoginEndpoint(dto.login_endpoint, true);
        this.#graph_scope = new ValueObjectScope(dto.graph_scope, true);
        this.#start_syncing_from = new ValueObjectTimestamp('start_syncing_from', dto.start_syncing_from, true);
        this.#last_synchronization = new ValueObjectTimestamp('last_synchronization', dto.last_synchronization, true);
        this.#folders = new ValueObjectFolders(dto.folders, true);
        this.#access_token = new ValueObjectToken('access_token', dto.access_token, true);
        this.#email_account = new ValueObjectEmail('email_account', dto.email_account, true);
        this.#vault = new ValueObjectBoolean('vault', dto.vault, true);
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        this.#vault_data = new ValueObjectJson('vault_data', dto.vault_data, true); //todo: tipar estructura de datos
        this.#is_active = new ValueObjectStatus('is_active', dto.is_active);
        this.#register_in_channel_hub = new ValueObjectBoolean(
            'register_in_channel_hub',
            dto.register_in_channel_hub ?? false
        );
        this.#channel_hub_connection_id = new ValueObjectString(
            'channel_hub_connection_id',
            dto.channel_hub_connection_id,
            true
        );
        this.#channel_hub_error = new ValueObjectJson('channel_hub_error', dto.channel_hub_error, true);
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.deleted_at = dto.deleted_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_by = dto.deleted_by;
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        this.#description = new ValueObjectDescription('description', value);
        this.changedAttributes.description = this.#description.value;
    }

    get type() {
        return this.#type;
    }

    set type(value) {
        this.#type = new ValueObjectTypes('type', value);
        this.changedAttributes.type = this.#type.value;
    }

    get host() {
        return this.#host;
    }

    set host(value) {
        this.#host = new ValueObjectHost('host', value, true);
        this.changedAttributes.host = this.#host.value;
    }

    get port() {
        return this.#port;
    }

    set port(value) {
        this.#port = new ValueObjectPort('port', value, true);
        this.changedAttributes.port = this.#port.value;
    }

    get protocol() {
        return this.#protocol;
    }

    set protocol(value) {
        this.#protocol = new ValueObjectProtocol('protocol', value, true);
        this.changedAttributes.protocol = this.#protocol.value;
    }

    get encryption() {
        return this.#encryption;
    }

    set encryption(value) {
        this.#encryption = new ValueObjectEncryption('encryption', value, true);
        this.changedAttributes.encryption = this.#encryption.value;
    }

    get username() {
        return this.#username;
    }

    set username(value) {
        this.#username = new ValueObjectVaultReference('username', value, true);
        this.changedAttributes.username = this.#username.value;
    }

    get password() {
        return this.#password;
    }

    set password(value) {
        this.#password = new ValueObjectVaultReference('password', value, true);
        this.changedAttributes.password = this.#password.value;
    }

    get from_address() {
        return this.#from_address;
    }

    set from_address(value) {
        this.#from_address = new ValueObjectEmail('from_address', value, true);
        this.changedAttributes.from_address = this.#from_address.value;
    }

    get from_name() {
        return this.#from_name;
    }

    set from_name(value) {
        this.#from_name = new ValueObjectName('from_name', value, true);
        this.changedAttributes.from_name = this.#from_name.value;
    }

    get tenant_id() {
        return this.#tenant_id;
    }

    set tenant_id(value) {
        this.#tenant_id = new ValueObjectVaultReference('tenant_id', value, true);
        this.changedAttributes.tenant_id = this.#tenant_id.value;
    }

    get client_id() {
        return this.#client_id;
    }

    set client_id(value) {
        this.#client_id = new ValueObjectVaultReference('client_id', value, true);
        this.changedAttributes.client_id = this.#client_id.value;
    }

    get client_secret() {
        return this.#client_secret;
    }

    set client_secret(value) {
        this.#client_secret = new ValueObjectVaultReference('client_secret', value, true);
        this.changedAttributes.client_secret = this.#client_secret.value;
    }

    get code() {
        return this.#code;
    }

    set code(value) {
        this.#code = new ValueObjectCode('code', value, true);
        this.changedAttributes.code = this.#code.value;
    }

    get refresh_token() {
        return this.#refresh_token;
    }

    set refresh_token(value) {
        this.#refresh_token = new ValueObjectToken('refresh_token', value, true);
        this.changedAttributes.refresh_token = this.#refresh_token.value;
    }

    get mails_download_limit() {
        return this.#mails_download_limit;
    }

    set mails_download_limit(value) {
        this.#mails_download_limit = new ValueObjectInt('mails_download_limit', value, true);
        this.changedAttributes.mails_download_limit = this.#mails_download_limit.value;
    }

    get login_endpoint() {
        return this.#login_endpoint;
    }

    set login_endpoint(value) {
        this.#login_endpoint = new ValueObjectLoginEndpoint(value, true);
        this.changedAttributes.login_endpoint = this.#login_endpoint.value;
    }

    get graph_scope() {
        return this.#graph_scope;
    }

    set graph_scope(value) {
        this.#graph_scope = new ValueObjectScope(value, true);
        this.changedAttributes.graph_scope = this.#graph_scope.value;
    }

    get start_syncing_from() {
        return this.#start_syncing_from;
    }

    set start_syncing_from(value) {
        this.#start_syncing_from = new ValueObjectTimestamp('start_syncing_from', value, true);
        this.changedAttributes.start_syncing_from = this.#start_syncing_from.value;
    }

    get last_synchronization() {
        return this.#last_synchronization;
    }

    set last_synchronization(value) {
        this.#last_synchronization = new ValueObjectTimestamp('last_synchronization', value, true);
        this.changedAttributes.last_synchronization = this.#last_synchronization.value;
    }

    get folders() {
        return this.#folders;
    }

    set folders(value) {
        this.#folders = new ValueObjectFolders(value);
        this.changedAttributes.folders = JSON.stringify(this.#folders.value);
    }

    get access_token() {
        return this.#access_token;
    }

    set access_token(value) {
        this.#access_token = new ValueObjectToken('access_token', value, true);
        this.changedAttributes.access_token = this.#access_token.value;
    }

    get email_account() {
        return this.#email_account;
    }

    set email_account(value) {
        this.#email_account = new ValueObjectEmail('email_account', value, true);
        this.changedAttributes.email_account = this.#email_account.value;
    }

    get vault() {
        return this.#vault;
    }

    set vault(value) {
        this.#vault = new ValueObjectBoolean('vault', value);
        this.changedAttributes.vault = this.#vault.value;
    }

    get vault_data() {
        return this.#vault_data;
    }

    set vault_data(value) {
        this.#vault_data = new ValueObjectJson('vault_data', value);
        this.changedAttributes.vault_data = JSON.stringify(this.#vault_data.value);
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        this.#is_active = new ValueObjectStatus('is_active', value);
        this.changedAttributes.is_active = this.#is_active.value;
    }

    get register_in_channel_hub() {
        return this.#register_in_channel_hub;
    }

    set register_in_channel_hub(value) {
        this.#register_in_channel_hub = new ValueObjectBoolean('register_in_channel_hub', value);
        this.changedAttributes.register_in_channel_hub = this.#register_in_channel_hub.value;
    }

    /**
     * Creates a new MailAccount object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the MailAccount object.
     * @returns {MailAccount} A new instance of the MailAccount class.
     */
    static create(dto) {
        return new MailAccount(dto);
    }

    /**
     *
     * @return {string}
     */
    channelHubAccountType() {
        let type;
        switch (this.#type.value) {
            case MailAccountsTypes.GMAIL_APPLICATION.value:
            case MailAccountsTypes.GMAIL_USER.value:
                type = 'gmail';
                break;
            case MailAccountsTypes.MS_GRAPH_APPLICATION.value:
            case MailAccountsTypes.MS_GRAPH_USER.value:
                type = 'microsoft';
                break;
            default:
                throw new DomainError(`Invalid type for Channel Hub: "${this.#type.value}"`, 500);
        }
        return type;
    }
}
