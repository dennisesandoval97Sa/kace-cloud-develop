export class ChannelHubAccountResponse {
    #account;

    constructor(account) {
        this.#account = account;
    }

    toJson() {
        if (!this.#account) return {};
        return {
            data: {
                id: this.#account.id.value,
                email: this.#account.email.value,
                name: this.#account.name.value,
                country_id: this.#account.country_id.value,
                operator_id: this.#account.operator_id.value,
                rest_flow_id: this.#account.rest_flow_id.value,
                mail_rule_list_rest_flow_id: this.#account.mail_rule_list_rest_flow_id.value,
                mail_rule_priority_update_rest_flow_id: this.#account.mail_rule_priority_update_rest_flow_id.value,
                channel_hub_connection_id: this.#account.channel_hub_connection_id.value,
                is_active: this.#account.is_active.value,
                channel_hub_error: this.#account.channel_hub_error.value,
                created_at: this.#account.created_at.value,
                updated_at: this.#account.updated_at.value,
                created_by: this.#account.created_by.value,
                updated_by: this.#account.updated_by.value,
            },
        };
    }
}
