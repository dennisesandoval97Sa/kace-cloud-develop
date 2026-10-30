/**
 * Class representing a response for a Geolocation object.
 */
export class GeolocationResponse {
    /** @type {Geolocation} is initialized in the constructor */
    #geolocation;

    /**
     * @param {Geolocation} geolocation
     */
    constructor(geolocation) {
        this.#geolocation = geolocation;
    }

    /**
     * Converts the Geolocation object to a JSON representation.
     * @returns {Object} The JSON representation of the Geolocation.
     */
    toJson() {
        if (!this.#geolocation) return {};
        return {
            data: {
                id: this.#geolocation.id.value,
                user_id: this.#geolocation.user_id.value,
                action_type: this.#geolocation.action_type.value,
                latitud: this.#geolocation.latitud.value,
                longitud: this.#geolocation.longitud.value,
                ip4_address: this.#geolocation.ip4_address.value,
                metadata: this.#geolocation.metadata.value,
                created_at: this.#geolocation.created_at.value,
                updated_at: this.#geolocation.updated_at.value,
                created_by: this.#geolocation.created_by.value,
                updated_by: this.#geolocation.updated_by.value,
                creator: this.#geolocation.creator === null ? null : this.#geolocation.creator.toJson(),
            },
        };
    }
}
