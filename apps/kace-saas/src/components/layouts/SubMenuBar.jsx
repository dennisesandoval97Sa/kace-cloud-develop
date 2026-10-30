import { TYPE_APPLICATION } from "@kace/utils";
import { Calendar } from "lucide-react";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import useUserInformation from "../../hooks/useUserInformation";
import { AnsUser } from "../core/AnsUser/AnsUser";
import { useAnsUserData } from "../core/AnsUser/hooks/useAnsUserData";
import ButtonIcon from "../core/ButtonIcon/ButtonIcon";
import { Helps } from "../core/Helps/Helps";
import { useHelpsData } from "../core/Helps/hooks/useHelpsData";
import { HighImpactCases } from "../core/HighImpactCases/HighImpactCases";
import useMyAgenda from "../core/MyAgenda/hooks/useMyAgenda";
import { isMyAgendaVisible } from "../core/MyAgenda/myAgendaVisibility";
import SearchClient from "../core/SearchClient/SearchClient";
import { cn, PopoverMenuUser } from "../ui-shared";
import { isAgentClientSearchVisible } from "./agentClientSearchVisibility";
import { LogoLayoutContainer } from "./LogoLayoutContainer";
import AdvancedSearch from "@/components/core/AdvancedSearch";

export const SubMenuBar = ({ currentApplication = "", handleChangeApp, handleCurrentPosition, logOut }) => {
    const { user, groups } = useUserInformation();
    const location = useLocation();
    const { t } = useTranslation();
    const configAgent = useSelector((state) => state.generalSetup.configAgent);
    const { helps, isLoading } = useHelpsData();
    const { ansUser } = useAnsUserData(user.id);
    const { setOpenedMyAgenda } = useMyAgenda();
    const currentGroup = groups.find((group) => group.id === user.selectedGroup);

    const defaultHeaderConfig = {
        search_clients: false,
        total_cases_by_ans: false,
        helps: false,
        custom_logo: "",
    };
    const loadedHeader = location.pathname.includes("/agent") ? configAgent?.header : null;
    const isHeaderLoaded = Boolean(loadedHeader);
    const configHeader = loadedHeader ?? defaultHeaderConfig;

    return (
        <div className="flex w-full gap-2 items-center justify-between flex-wrap">
            <div
                className={cn("hidden lg:flex items-center gap-2 flex-1", {
                    flex: !location.pathname.includes("/agent"),
                })}
            >
                <LogoLayoutContainer configHeader={configHeader} currentGroup={currentGroup} />
            </div>
            {currentApplication === TYPE_APPLICATION.AGENT || location.pathname.includes("/agent") ? (
                isAgentClientSearchVisible(configAgent) ? (
                    <div className="w-2/3 lg:w-1/3 order-first lg:order-none min-w-0">
                        <div className="flex min-w-0 w-full items-center justify-center gap-2">
                            <SearchClient />
                            <AdvancedSearch isAgent />
                        </div>
                    </div>
                ) : (
                    <AdvancedSearch isAgent />
                )
            ) : null}

            <div className="flex items-center gap-2 justify-end flex-1">
                <div className="hidden lg:flex gap-2 items-center">
                    {configHeader.total_cases_by_ans &&
                        (currentApplication === TYPE_APPLICATION.AGENT || location.pathname.includes("/agent")) && (
                            <AnsUser contadores={ansUser} />
                        )}
                    {configHeader.helps &&
                        (currentApplication === TYPE_APPLICATION.AGENT || location.pathname.includes("/agent")) && (
                            <Helps helpsData={helps} isLoading={isLoading} />
                        )}
                    {isMyAgendaVisible(configHeader, isHeaderLoaded) &&
                        (currentApplication === TYPE_APPLICATION.AGENT || location.pathname.includes("/agent")) && (
                            <div className="flex justify-start">
                                <ButtonIcon
                                    tooltip={t("diary.agenda.title")}
                                    onClick={() => setOpenedMyAgenda()}
                                    id="btn_sub_menu_diary"
                                    datta-testid="btn_sub_menu_diary"
                                >
                                    <Calendar />
                                </ButtonIcon>
                            </div>
                        )}
                    {configHeader.high_impact_fields &&
                        (currentApplication === TYPE_APPLICATION.AGENT || location.pathname.includes("/agent")) && (
                            <HighImpactCases />
                        )}
                </div>
                <div className="flex items-center">
                    <PopoverMenuUser
                        logOut={logOut}
                        handleChangeApp={handleChangeApp}
                        handleCurrentPosition={handleCurrentPosition}
                        configHeader={configHeader}
                        isHeaderLoaded={isHeaderLoaded}
                        ansUser={ansUser}
                        currentApplication={currentApplication}
                        helps={helps}
                        isLoading={isLoading}
                        currentGroup={currentGroup}
                        setOpenedMyAgenda={setOpenedMyAgenda}
                    />
                </div>
            </div>
        </div>
    );
};

SubMenuBar.propTypes = {
    currentApplication: PropTypes.string,
    handleChangeApp: PropTypes.func,
    handleCurrentPosition: PropTypes.func,
    logOut: PropTypes.func,
};
