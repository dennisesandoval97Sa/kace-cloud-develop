import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kace/ui-shared";
import { TabAgent } from "./TabAgent";
import { TabAdmin } from "./TabAdmin";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";

export const GeneralSetupTabsContainer = ({
    values = {},
    setFieldValue,
    errors = {},
    touched = {},
}) => {
    const { t } = useTranslation();

    return (
        <Tabs defaultValue="agent" className="w-full">
            <TabsList className="relative !z-40">
                <TabsTrigger value="agent" id="btn_general_tab_adviser" data-testid="btn_btn_general_tab_adviser">
                    {t("generalSetup.form.title.asesor")}
                </TabsTrigger>
                <TabsTrigger
                    value="admin"
                    id="btn_general_tab_administrator"
                    data-testid="btn_general_tab_administrator"
                >
                    {t("generalSetup.form.title.administrador")}
                </TabsTrigger>
            </TabsList>
            <TabsContent
                value="agent"
                className="flex w-full"
                id="general_agent_tab_content"
                data-testid="general_agent_tab_content"
            >
                <TabAgent values={values} setFieldValue={setFieldValue} errors={errors} touched={touched} />
            </TabsContent>
            <TabsContent value="admin" id="general_content_tab_admin" data-testid="general_content_tab_admin">
                <TabAdmin
                    values={values}
                    setFieldValue={setFieldValue}
                    errors={errors}
                    touched={touched}
                    id="general_values_tab_admin"
                    data-testid="general_values_tab_admin"
                />
            </TabsContent>
        </Tabs>
    );
};

GeneralSetupTabsContainer.propTypes = {
    values: PropTypes.object,
    setFieldValue: PropTypes.func,
    errors: PropTypes.object,
    touched: PropTypes.object,
};
