export class AutomationSettingsResponse {
    /** @type {AutomationSettings} is initialized in the constructor */
    #automationSettings;

    /**
     * Creates an instance of `AutomationSettingsResponse`.
     *
     * @param {AutomationSettings} endpoint - The `AutomationSettings` instance.
     */
    constructor(endpoint) {
        this.#automationSettings = endpoint;
    }

    /**
     * Converts the `AutomationSettings` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the AutomationSettings data.
     */
    toJson() {
        if (!this.#automationSettings) return {};

        const fields = ['id', 'description', 'frequency', 'start_date', 'end_date'];

        const data = fields.reduce((acc, field) => {
            acc[field] = this.#automationSettings[field]?.value;
            return acc;
        }, {});
        data.created_at = this.#automationSettings.created_at.value;
        data.updated_at = this.#automationSettings.updated_at.value;

        return { data };
    }
}
