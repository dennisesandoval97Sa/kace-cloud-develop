export class MailAccountResponse {
    /** @type {MailAccount} is initialized in the constructor */
    #mailAccount;
    constructor(mailAccount) {
        this.#mailAccount = mailAccount;
    }
    /**
     * Converts the MailAccount object to a JSON representation.
     *
     * @returns {Object} A plain object containing the MailAccount data.
     */
    toJson() {
        if (!this.#mailAccount) return {};

        return {
            data: {
                id: this.#mailAccount.id.value,
                description: this.#mailAccount.description.value,
                type: this.#mailAccount.type.value,
                host: this.#mailAccount.host.value,
                port: this.#mailAccount.port.value,
                protocol: this.#mailAccount.protocol.value,
                encryption: this.#mailAccount.encryption.value,
                username: this.#mailAccount.username.value,
                password: this.#mailAccount.password.value,
                from_address: this.#mailAccount.from_address.value,
                from_name: this.#mailAccount.from_name.value,
                tenant_id: this.#mailAccount.tenant_id.value,
                client_id: this.#mailAccount.client_id.value,
                client_secret: this.#mailAccount.client_secret.value,
                code: this.#mailAccount.code.value,
                refresh_token: this.#mailAccount.refresh_token.value,
                mails_download_limit: this.#mailAccount.mails_download_limit.value,
                login_endpoint: this.#mailAccount.login_endpoint.value,
                graph_scope: this.#mailAccount.graph_scope.value,
                start_syncing_from: this.#mailAccount.start_syncing_from.value,
                last_synchronization: this.#mailAccount.last_synchronization.value,
                folders: this.#mailAccount.folders.value,
                access_token: this.#mailAccount.access_token.value,
                email_account: this.#mailAccount.email_account.value,
                vault: this.#mailAccount.vault.value,
                vault_data: this.#mailAccount.vault_data.value,
                register_in_channel_hub: this.#mailAccount.register_in_channel_hub.value,
                is_active: this.#mailAccount.is_active.value,
                created_at: this.#mailAccount.created_at.value,
                updated_at: this.#mailAccount.updated_at.value,
                created_by: this.#mailAccount.created_by.value,
                updated_by: this.#mailAccount.updated_by.value,
            },
        };
    }
}
