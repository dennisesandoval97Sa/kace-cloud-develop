export class WorkspaceResponse {
    /** @type {Workspaces} is initialized in the constructor */
    #workspace;
    /**
     *
     * @param {Workspaces} workspace
     */
    constructor(workspace) {
        this.#workspace = workspace;
    }

    toJson() {
        if (this.#workspace === null) return {};

        const response = {
            id: this.#workspace.id.value,
            description: this.#workspace.description.value,
            is_active: this.#workspace.is_active.value,
            tag: this.#workspace.tag.value,
            rules: this.#workspace.rules.value,
            mails_accounts: this.#workspace.mails_accounts.value,
            channel_hub_accounts: this.#workspace.channel_hub_accounts.value,
            groups: this.#workspace.groups.value,
            tag_creation_flow_id: this.#workspace.tag_creation_flow_id.value,
            tag_update_flow_id: this.#workspace.tag_update_flow_id.value,
            tag_deletion_flow_id: this.#workspace.tag_deletion_flow_id.value,
            created_by: this.#workspace.created_by.value,
            created_at: this.#workspace.created_at.value,
            updated_by: this.#workspace.updated_by?.value,
            updated_at: this.#workspace.updated_at?.value,
        };

        return {
            data: response,
        };
    }
}
