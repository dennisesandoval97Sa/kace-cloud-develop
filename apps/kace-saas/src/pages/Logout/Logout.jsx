import { Button, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@kace/ui-shared";
import { COGNITO_LOGIN, URL_LOGO_KONECTA } from "@kace/urls"
import { useTranslation } from "react-i18next"
const Logout = () => {
    const { t,i18n } = useTranslation()

    const login = () => {
        window.location.href = COGNITO_LOGIN
    }
    const changeLanguage = (lang) => {
        i18n.changeLanguage(lang)
        localStorage.setItem("lang_code", lang)
    }
    return (
        <div className="flex flex-col items-center w-full min-h-screen bg-darkPurpleCustom text-white">
            <div className="w-full xl:w-5/6 flex flex-col justify-evenly h-[70vh]">
                <div className="flex flex-col gap-y-6 items-center justify-between w-full px-8 py-4 sm:flex-row">
                    <img
                        src={URL_LOGO_KONECTA}
                        alt="logo konecta"
                        className="max-w-[180px] w-auto h-auto"
                    />
                    <Select className="border-2 bg-transparent" defaultValue={i18n.language} onValueChange={(value) => changeLanguage(value)}>
                        <SelectTrigger className="w-[180px] bg-transparent outline-none">
                            <SelectValue placeholder="Selecciona un idioma" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="es">Español</SelectItem>
                                <SelectItem value="en">Inglés</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col justify-center items-center text-center mt-24 px-4">
                    <h1 className="text-4xl font-bold mb-4">{t("text.sesionClosedSuccessfully")}</h1>
                    <p className="text-xl mb-8">
                        {t("text.gratitudeMessage")}
                    </p>
                    <Button
                        className="border-2 border-yellowCustom bg-transparent text-yellowCustom hover:bg-transparent"
                        onClick={() => login()}
                    >
                        {t("text.login")}
                    </Button>
                </div>

            </div>
        </div>
    );
};

export default Logout;
