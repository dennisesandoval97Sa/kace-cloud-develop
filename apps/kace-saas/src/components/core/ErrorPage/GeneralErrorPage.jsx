import { Button } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { LogoIcon } from "../../ui-shared/src/icons";
import { useTranslation } from "react-i18next";

export const GeneralErrorPage = ({ refetch = null, message = null, buttonText = "app.button.tryAgain", showDefaultMessage = true }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blueCustom via-primary to-primary">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
                {message && <h2 className="text-2xl font-semibold text-gray-700 mb-6">{t(message)}</h2>}
                <div className="flex justify-center items-center">
                    <LogoIcon height={150} width={150} color="bg-blueCustom" />
                </div>
                <h1 className="text-4xl font-bold text-gray-800 mb-4">Oops!</h1>
                {showDefaultMessage &&
                    <>
                        <h2 className="text-2xl font-semibold text-gray-700 mb-6">{t("app.text.somethingWrong")}</h2>
                        <p className="text-lg text-gray-600 mb-8">{t("app.text.dontWorry")}</p>
                    </>
                }
                {refetch && (
                    <Button
                        onClick={() => refetch()}
                        className="bg-gradient-to-r from-blueCustom to-primary hover:from-blueCustom hover:to-primary text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        {t(buttonText)}
                    </Button>
                )}
            </div>
        </div>
    );
};

GeneralErrorPage.propTypes = {
    refetch: PropTypes.func,
    message: PropTypes.string,
    buttonText: PropTypes.string,
    showDefaultMessage: PropTypes.bool
};
