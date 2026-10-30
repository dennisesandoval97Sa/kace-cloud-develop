export class UserNotificationResponse {
    /** @type {UserNotification} is initialized in the constructor */
    #userNotification;

    /**
     * Creates an instance of `UserNotificationResponse`.
     *
     * @param {UserNotification} notification - The `UserNotification` instance.
     */
    constructor(notification) {
        this.#userNotification = notification;
    }

    /**
     * Converts the `UserNotification` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the notification data.
     */
    toJson() {
        if (!this.#userNotification) return {};

        return {
            data: {
                id: this.#userNotification.id.value,
                asunto: this.#userNotification.asunto.value,
                mensaje: this.#userNotification.mensaje.value,
                fecha_inicio: this.#userNotification.fecha_inicio.value,
                fecha_fin: this.#userNotification.fecha_fin.value,
                leida: this.#userNotification.leida.value,
                leida_por: this.#userNotification.leida_por.value,
                user_id: this.#userNotification.user_id.value,
                is_active: this.#userNotification.is_active.value,
                created_at: this.#userNotification.created_at.value,
                updated_at: this.#userNotification.updated_at.value,
                created_by: this.#userNotification.created_by.value,
                updated_by: this.#userNotification.updated_by.value,
            },
        };
    }
}
