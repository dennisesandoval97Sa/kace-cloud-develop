export class ActionResponse {
    /**
     * @type {Action}
     * is initialized in the constructor
     */
    #action;

    /**
     * Creates an instance of ActionResponse.
     *
     * @param {Action} action - The Action instance.
     */
    constructor(action) {
        this.#action = action;
    }

    /**
     * Converts the Action object to a JSON representation.
     *
     * @returns {Object} A flat object containing the Action data.
     */
    toJson() {
        if (!this.#action) return {};

        return {
            data: {
                id: this.#action.id.value,
                action_type: this.#action.action_type.value,
                description: this.#action.description.value,
                conditions: this.#action.conditions.value,
                triggers: this.#action.triggers.value,
                permissions: this.#action.permissions.value,
                state_id: this.#action.state_id.value,
                group_id: this.#action.group_id.value,
                responsible_id: this.#action.responsible_id.value,
                template_id: this.#action.template_id.value,
                mail_account_id: this.#action.mail_account_id.value,
                advisor_list_id: this.#action.advisor_list_id.value,
                group_list_id: this.#action.group_list_id.value,
                ws_rest_flow_id: this.#action.ws_rest_flow_id.value,
                model_update_id: this.#action.model_update_id.value,
                external_group_code: this.#action.external_group_code.value,
                external_user_code: this.#action.external_user_code.value,
                external_group_dynamic_code: this.#action.external_group_dynamic_code.value,
                external_user_dynamic_code: this.#action.external_user_dynamic_code.value,
                priority: this.#action.priority.value,
                is_active: this.#action.is_active.value,
                automation_id: this.#action.automation_id.value,
                entity: this.#action.entity.value,
                created_at: this.#action.created_at.value,
                created_by: this.#action.created_by.value,
                updated_at: this.#action.updated_at.value,
                updated_by: this.#action.updated_by.value,
            },
        };
    }
}
