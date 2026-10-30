export class GeolocationTypes {
    static LOGIN = new GeolocationTypes("LOGIN", "geolocation_login_bool");
    static CLIENT_SEARCH = new GeolocationTypes("CLIENT_SEARCH", "geolocation_client_search_bool");
    static CASE_CREATION = new GeolocationTypes("CASE_CREATION", "geolocation_case_creation_bool");
    static CASE_UPDATE = new GeolocationTypes("CASE_UPDATE", "geolocation_case_update_bool");
    static CLIENT_CREATION = new GeolocationTypes("CLIENT_CREATION", "geolocation_client_creation_bool");
    static CLIENT_UPDATE = new GeolocationTypes("CLIENT_UPDATE", "geolocation_client_update_bool");
    static LOGOUT = new GeolocationTypes("LOGOUT", "geolocation_logout_bool");
    static SESSION_RENEWAL = new GeolocationTypes("SESSION_RENEWAL", "geolocation_session_renewal_bool");
    static CURRENT_LOCATION = new GeolocationTypes("CURRENT_LOCATION", "geolocation_current_location_bool");

    constructor(key, value) {
        this.#ensureIsValidMedition(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        switch (value) {
            case "geolocation_login_bool":
                return GeolocationTypes.LOGIN;
            case "geolocation_client_search_bool":
                return GeolocationTypes.CLIENT_SEARCH;
            case "geolocation_case_creation_bool":
                return GeolocationTypes.CASE_CREATION;
            case "geolocation_case_update_bool":
                return GeolocationTypes.CASE_UPDATE;
            case "geolocation_client_creation_bool":
                return GeolocationTypes.CLIENT_CREATION;
            case "geolocation_client_update_bool":
                return GeolocationTypes.CLIENT_UPDATE;
            case "geolocation_logout_bool":
                return GeolocationTypes.LOGOUT;
            case "geolocation_session_renewal_bool":
                return GeolocationTypes.SESSION_RENEWAL;
            case "geolocation_current_location_bool":
                return GeolocationTypes.CURRENT_LOCATION;
            default:
                throw new Error("Invalid value");
        }
    }

    static fromKey(key) {
        switch (key) {
            case "LOGIN":
                return GeolocationTypes.LOGIN.value;
            case "CLIENT_SEARCH":
                return GeolocationTypes.CLIENT_SEARCH.value;
            case "CASE_CREATION":
                return GeolocationTypes.CASE_CREATION.value;
            case "CASE_UPDATE":
                return GeolocationTypes.CASE_UPDATE.value;
            case "CLIENT_CREATION":
                return GeolocationTypes.CLIENT_CREATION.value;
            case "CLIENT_UPDATE":
                return GeolocationTypes.CLIENT_UPDATE.value;
            case "LOGOUT":
                return GeolocationTypes.LOGOUT.value;
            case "SESSION_RENEWAL":
                return GeolocationTypes.SESSION_RENEWAL.value;
            case "CURRENT_LOCATION":
                return GeolocationTypes.CURRENT_LOCATION.value;
            default:
                throw new Error("Invalid key");
        }
    }

    #ensureIsValidMedition(value) {
        const validValues = [
            "geolocation_login_bool",
            "geolocation_client_search_bool",
            "geolocation_case_creation_bool",
            "geolocation_case_update_bool",
            "geolocation_client_creation_bool",
            "geolocation_client_update_bool",
            "geolocation_logout_bool",
            "geolocation_session_renewal_bool",
            "geolocation_current_location_bool",
        ];

        if (!value) {
            throw new Error("The value cannot be null");
        }
        if (!validValues.includes(value)) {
            throw new Error(`The value must be a valid Medition: ${value}`);
        }
    }

    static getLabel(value) {
        const labelsMap = {
            geolocation_login_bool: "Inicio de sesión",
            geolocation_client_search_bool: "Búsqueda de cliente",
            geolocation_case_creation_bool: "Creación de caso",
            geolocation_case_update_bool: "Actualización de caso",
            geolocation_client_creation_bool: "Creación de cliente",
            geolocation_client_update_bool: "Actualización de cliente",
            geolocation_logout_bool: "Cierre de sesión",
            geolocation_session_renewal_bool: "Renovación de sesión",
            geolocation_current_location_bool: "Ubicación actual",
        };

        if (!value) return Object.values(labelsMap);

        if (labelsMap[value]) return labelsMap[value];

        const foundKey = Object.keys(labelsMap).find((key) => labelsMap[key] === value);
        return foundKey || value;
    }

    static toJson() {
        return {
            LOGIN: GeolocationTypes.LOGIN.value,
            CLIENT_SEARCH: GeolocationTypes.CLIENT_SEARCH.value,
            CASE_CREATION: GeolocationTypes.CASE_CREATION.value,
            CASE_UPDATE: GeolocationTypes.CASE_UPDATE.value,
            CLIENT_CREATION: GeolocationTypes.CLIENT_CREATION.value,
            CLIENT_UPDATE: GeolocationTypes.CLIENT_UPDATE.value,
            LOGOUT: GeolocationTypes.LOGOUT.value,
            SESSION_RENEWAL: GeolocationTypes.SESSION_RENEWAL.value,
            CURRENT_LOCATION: GeolocationTypes.CURRENT_LOCATION.value,
        };
    }
}
