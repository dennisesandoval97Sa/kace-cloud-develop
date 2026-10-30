import { toast } from "react-toastify";
import { publicIpv4 } from "public-ip";

export const filterEmptyValues = (values) => {
    return Object.entries(values).reduce((_values, [key, value]) => {
        if (value) {
            _values[key] = value;
        }
        return _values;
    }, {});
};

export const removeKey = (values, keysToRemove) => {
    return Object.entries(values).reduce((_values, [key, value]) => {
        if (!keysToRemove.includes(key)) {
            _values[key] = value;
        }
        return _values;
    }, {});
};

export const copyClipboard = async (navigator, text) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success("ID Copiado");
    } catch {
        // NO-SONAR: Si ocurre un error al copiar al portapapeles, se maneja silenciosamente y no interrumpe el flujo.
        return false;
    }
    return true;
};

export const formatClassifications = (data, key = "nivel") => {
    const text = [...Array(10)]
        .reduce((acc, _, index) => {
            if (data[`${key}${index + 1}`]) acc.push(data[`${key}${index + 1}`]);
            return acc;
        }, [])
        .join(" -> ");
    return text.length > 60 ? text.slice(0, 60) + " ..." : text;
};

export const getLabel = (source, key, defaultLabel = "") => {
    const label = source?.[key] || defaultLabel;
    return label || key;
};
export const getCurrentLang = () => {
    let langCode = window.localStorage.getItem("lang_code");
    if (!langCode) {
        const userLocale =
            navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language;
        langCode = userLocale.split("-")[0];
    }

    return langCode;
};

export const isTextAreaEmpty = (value) => {
    const element = document.createElement("div");
    element.innerHTML = value;
    return element.textContent || false;
};

export const validationSameDayFormik = (value) => {
    const selectedDate = new Date(`${value}T00:00:00`);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    return selectedDate < currentDate;
};

export const getIpUser = async () => {
    try {
        const ip = await publicIpv4();
        return ip;
    } catch {
        // NO-SONAR: Si ocurre un error al obtener la IP, se devuelve "0.0.0.0" como valor predeterminado para no interrumpir el flujo.
        return "0.0.0.0";
    }
};

export const getLocation = () => {
    return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            const error = {
                code: 0,
                message: "Geolocation not supported",
            };
            reject(error);
        } else {
            /**
             * NO-SONAR: El uso de esta funcion del navigator
             * es necesario debido a que por requisitos de la aplicación se
             * debe de capturar la ubicación del usuario en ciertos momentos.
             */
            const timeoutId = setTimeout(() => {
                const error = {
                    code: 3,
                    message: "Geolocation request timed out",
                };
                reject(error);
            }, 10000);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    clearTimeout(timeoutId);
                    const locationData = {
                        loaded: true,
                        coordinates: {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        },
                        error: null,
                    };
                    resolve(locationData);
                },
                (error) => {
                    clearTimeout(timeoutId);
                    const locationData = {
                        loaded: true,
                        coordinates: { lat: "", lng: "" },
                        error: {
                            code: error.code,
                            message: error.message,
                        },
                    };
                    reject(locationData);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 8000,
                    maximumAge: 60000,
                },
            );
        }
    });
};

export const getI18ForErrors = (t, position, message, callback) => {
    const [prefix, ...rest] = message.split(":");
    const positionError = position ? `.${position}` : "";
    const key = `errors${positionError}.${prefix.replace(/,/g, "").replace(/ /g, "_")}`;
    const context = rest.join(":").trim();

    if (context) {
        callback(t(key, { context }));
    } else {
        callback(t(key));
    }
};

export const formatTestId = (prefix, value, { clean = false } = {}) => {
    if (!value) return `${prefix}_empty`;

    let finalValue = value.replace(/^\//, "");

    if (clean) {
        finalValue = value
            ?.split(".")
            ?.pop()
            ?.toLowerCase()
            ?.replace(/\s+/g, "_")
            ?.replace(/\./g, "_")
            ?.replace(/[^a-z0-9_]/g, "");
    } else {
        finalValue = value?.toLowerCase()?.replace(/\s+/g, "_")?.replace(/\./g, "_");
    }

    return `${prefix}_${finalValue}`;
};

const DELETE_ACTION_LITERALS = new Set(["Eliminar", "Delete"]);

/*
 * Screens label the delete action either with `t("app.forms.delete")` or with a literal,
 * so all of them are recognized in every language; otherwise the action skips its confirmation.
 */
export const isDeleteAction = (name, t) => name === t("app.forms.delete") || DELETE_ACTION_LITERALS.has(name);
