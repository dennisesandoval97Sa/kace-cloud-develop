import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";

import { CardModulesTab } from "./CardModulesTab";
import { InputsClassificationContainer } from "./InputsClassificationContainer";
import { InputsClientsContainer } from "./InputsClientsContainer";
import InputsCasesContainer from "./InputsCasesContainer";

export const TabAdmin = ({ setFieldValue, values = {} }) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-4 justify-center items-start p-2">
            <div className="flex flex-col w-full">
                <CardModulesTab
                    title={t("generalSetup.form.title.clasificaciones")}
                    description={t("generalSetup.form.title.subtitleAsesor")}
                >
                    <InputsClassificationContainer values={values} />
                </CardModulesTab>
            </div>
            <div className="flex flex-col w-full">
                <CardModulesTab
                    title={t("generalSetup.form.title.clients")}
                    description={t("generalSetup.form.title.subtitleAsesor")}
                >
                    <InputsClientsContainer />
                </CardModulesTab>
            </div>
            <div className="flex flex-col w-full">
                <CardModulesTab
                    title={t("generalSetup.form.title.cases")}
                    description={t("generalSetup.form.title.subtitleAsesor")}
                >
                    <InputsCasesContainer
                        values={values}
                        setFieldValue={setFieldValue}
                    />
                </CardModulesTab>
            </div>
        </div>
    );
};

TabAdmin.propTypes = {
    values: PropTypes.object,
    setFieldValue: PropTypes.func,
    errors: PropTypes.object,
    touched: PropTypes.object,
};
