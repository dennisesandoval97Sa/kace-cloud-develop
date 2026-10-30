import PropTypes from "prop-types";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import en from "@/locale/en.json";
import es from "@/locale/es.json";

export const createChannelHubTestI18n = (language = "en") => {
    const instance = i18next.createInstance();
    instance.use(initReactI18next).init({
        lng: language,
        fallbackLng: "en",
        initImmediate: false,
        interpolation: { escapeValue: false },
        resources: {
            en: { translation: en },
            es: { translation: es },
        },
    });
    return instance;
};

export const ChannelHubTestI18nProvider = ({ children, language = "en" }) => (
    <I18nextProvider i18n={createChannelHubTestI18n(language)}>{children}</I18nextProvider>
);

ChannelHubTestI18nProvider.propTypes = {
    children: PropTypes.node.isRequired,
    language: PropTypes.oneOf(["en", "es"]),
};
