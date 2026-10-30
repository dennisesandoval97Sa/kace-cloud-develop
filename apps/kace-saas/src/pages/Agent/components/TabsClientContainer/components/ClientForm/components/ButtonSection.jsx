import { Button } from "@kace/ui-shared";
import { PlusIcon, UserIcon, UserPen } from "lucide-react";
import PropTypes from "prop-types";
import React, { useMemo } from "react";
import { useAgentContext } from "../../../../../context/AgentContext";
import useButtonSection from "../hooks/useButtonSection";
import ExpressCasesButton from "@/pages/Agent/components/TabsClientContainer/components/ClientForm/components/ExpressCasesButton";
import { UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

export const ButtonSection = ({ isAnyLoading, resetUser = () => {} }) => {
    const { clientId, isNewClient, configAgent } = useAgentContext();
    const configClients = configAgent.clients;
    const { t } = useTranslation();

    const { handleNewCase, showCreateButton, showNewCaseButton, showUpdateButton, handleReset } = useButtonSection({
        clientId,
        isNewClient,
        configClients,
        resetUser,
    });

    const expressCasesOptions = useMemo(() => {
        const expressCasesConfig = configAgent.cases?.express_cases || [];
        return expressCasesConfig.map((config) => ({
            id: config.id,
            label: config.label,
            value: config.one_script_form_id,
        }));
    }, [configAgent.cases?.express_cases]);

    const showCasesButton = configAgent?.cases?.show_cases_button;
    const showSaveClientBtn = configAgent.cases?.show_save_client_button;
    const showNewClientBtn = configAgent.cases?.show_new_client_button;
    const showUpdatetBtn = configClients?.show_update_button;

    return (
        <div className="flex justify-center items-center gap-2">
            {expressCasesOptions.length > 0 && <ExpressCasesButton options={expressCasesOptions} />}
            {showCreateButton && showSaveClientBtn && (
                <Button
                    type="submit"
                    className="h-10 flex gap-1"
                    disabled={isAnyLoading}
                    id="btn_section_save"
                    data-testid="btn_section_save"
                >
                    <UserIcon width={18} height={18} />
                    <p className="max-sm:hidden">{t("app.button.save")}</p>
                </Button>
            )}
            {showNewCaseButton && showCasesButton && (
                <Button
                    type="button"
                    className="h-10 flex gap-1 bg-blueCustom hover:bg-blueCustom/90"
                    onClick={handleNewCase}
                    id="btn_section_new_case"
                    data-testid="btn_section_new_case"
                >
                    <PlusIcon width={22} height={22} />
                    <p className="max-sm:hidden">{t("app.button.newCases")}</p>
                </Button>
            )}
            {showUpdateButton && showUpdatetBtn && (
                <Button
                    type="submit"
                    className="h-10 flex gap-1"
                    disabled={isAnyLoading}
                    id="btn_section_update"
                    data-testid="btn_section_update"
                >
                    <UserPen width={18} height={18} />
                    <p className="max-sm:hidden">{t("app.button.update")}</p>
                </Button>
            )}
            {showCreateButton && showNewClientBtn && (
                <Button
                    onClick={handleReset}
                    type="button"
                    className="bg-greenCustom px-4 py-2 hover:bg-greenCustom/90 h-10 flex gap-1"
                    id="btn_type_new_client"
                    data-testid="btn_type_new_client"
                >
                    <UserPlus height={18} width={18} />
                    <p className="max-sm:hidden">{t("app.button.newClient")}</p>
                </Button>
            )}
        </div>
    );
};

ButtonSection.propTypes = {
    isAnyLoading: PropTypes.bool,
    resetUser: PropTypes.func,
};

export default React.memo(ButtonSection);
