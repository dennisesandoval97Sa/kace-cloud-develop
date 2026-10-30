import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./es.json";
import en from "./en.json";
import { globalES, globalEN, getCurrentLang } from "@kace/utils";

const capitalizeFirstLetter = (value) => {
    if (typeof value !== "string") return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
};

i18n.use(initReactI18next).init({
    fallbackLng: "es",
    lng: getCurrentLang(),
    interpolation: {
        escapeValue: false,
        format: (value, format) => {
            if (format === "capitalize") {
                return capitalizeFirstLetter(value);
            }

            return value;
        },
    },
    resources: {
        en: {
            translation: { ...globalEN, ...en },
        },
        es: {
            translation: { ...globalES, ...es },
        },
    },
});

export default i18n;
