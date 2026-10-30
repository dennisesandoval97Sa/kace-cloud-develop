import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { ADMIN_CASE_TAB_DATA } from "../data/constants";
import AdminCaseComments from "./AdminCaseComments/AdminCaseComments";
import AdminCaseForm from "./AdminCaseForm";
import useAdminCaseParams from "../hooks/useAdminCaseParams";
import AdminCaseTransitions from "./AdminCaseTransitions/AdminCaseTransitions";
import AdminCasesCalendar from "./AdminCasesCalendar";
import { AdminCaseClient } from "./AdminCaseClient/AdminCaseClient";
import AdminCaseLogs from "./AdminCaseLogs";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import AdminCasesOneScriptKaceComponents from "@/pages/Cases/components/AdminCase/components/AdminCasesOneScriptKaceComponents";
import AdminCaseExpressCase from "@/pages/Cases/components/AdminCase/components/AdminCaseExpressCase";
import AdminCaseSubCases from "./AdminCaseSubCases/AdminCaseSubCases";
import AdminCaseInteractions from "./AdminCaseInteractions/AdminCaseInteractions";
import AdminCaseNotifications from "./AdminCaseNotifications/AdminCaseNotifications";
import useAdminCaseCase from "../hooks/useAdminCaseCase";

const AdminCaseTabContainer = () => {
    const { t } = useTranslation();
    const { cases, show_interactions, show_case, show_client, show_transitions, show_subcase } = useConfigAgentData();
    const { caseId: caseIdFromParams } = useAdminCaseParams();
    const { casesData } = useAdminCaseCase(caseIdFromParams);

    const notificationsEnabled = useMemo(
        () => Boolean(cases?.show_notifications) && Boolean(cases?.notifications_one_script_form),
        [cases],
    );
    const { caseId, oneScriptFormId } = useAdminCaseParams();

    const showOneScriptKaceComponents = useMemo(
        () => Boolean(cases?.allow_new_one_script_forms) && Boolean(cases?.cases_one_script_base_form),
        [cases],
    );

    const calendarEnabled = useMemo(() => cases?.show_sheduler ?? false, [cases]);

    const commentsEnabled = useMemo(() => cases?.show_comment_tab ?? false, [cases]);

    const eventLogsEnable = useMemo(() => cases?.show_event_log ?? false, [cases]);
    const interectionsEnable = useMemo(() => show_interactions ?? false, [show_interactions]);
    const caseEnable = useMemo(() => show_case ?? false, [show_case]);
    const clientEnable = useMemo(() => show_client ?? false, [show_client]);
    const transitionsEnable = useMemo(() => show_transitions ?? false, [show_transitions]);
    const subcaseEnable = useMemo(() => show_subcase ?? false, [show_subcase]);

    const refreshCustomer = !!cases?.refresh_tab_customer;
    const refreshTransitions = !!cases?.refresh_tab_transitions;
    const refreshSubcases = !!cases?.refresh_tab_subcases;
    const refreshComments = !!cases?.refresh_tab_comments;
    const refreshAgenda = !!cases?.refresh_tab_agenda;
    const refreshLogs = !!cases?.refresh_tab_logs;
    const refreshInteractions = !!cases?.refresh_tab_interactions;
    const refreshNotifications = !!cases?.refresh_tab_notifications;

    const [activeTab, setActiveTab] = useState("case");

    const tabPanelClassCase = "mt-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden";
    const tabPanelClassScroll = "mt-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-auto";

    return (
        <Tabs
            defaultValue="case"
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
        >
            <TabsList className="flex h-auto w-full min-w-0 shrink-0 flex-col gap-1 p-1 drop-shadow-md sm:min-h-10 sm:flex-row sm:items-stretch sm:gap-2">
                {ADMIN_CASE_TAB_DATA.filter((tab) => {
                    if (tab.value === "agenda" && !calendarEnabled) return false;
                    if (tab.value === "logs" && !eventLogsEnable) return false;
                    if (tab.value === "comments" && !commentsEnabled) return false;
                    if (tab.value === "interactions" && !interectionsEnable) return false;
                    if (tab.value === "notifications" && !notificationsEnabled) return false;
                    if (tab.value === "case" && !caseEnable) return false;
                    if (tab.value === "customer" && !clientEnable) return false;
                    if (tab.value === "transitions" && !transitionsEnable) return false;
                    if (tab.value === "sub-cases" && !subcaseEnable) return false;
                    return true;
                }).map((tab) => {
                    const isDisabled =
                        ["comments", "transitions", "sub-cases", "logs", "notifications"].includes(tab.value) &&
                        !caseId;

                    return (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="flex min-h-10 w-full flex-none items-center justify-center gap-1 overflow-hidden border-b px-2 text-center text-xs sm:min-w-0 sm:flex-1 sm:basis-0 sm:gap-2 sm:border-gray-300 sm:px-2 sm:text-sm lg:border-none max-sm:last:border-b-0"
                            disabled={isDisabled}
                            id={`adm_case_tab_${tab.value}`}
                            data-testid={`adm_case_tab_${tab.value}`}
                        >
                            <span className="inline-flex shrink-0">{tab.icon}</span>
                            <span className="min-w-0 sm:truncate">{t(tab.title)}</span>
                        </TabsTrigger>
                    );
                })}
            </TabsList>
            <TabsContent value="case" forceMount className={tabPanelClassCase}>
                {oneScriptFormId ? (
                    <AdminCaseExpressCase />
                ) : showOneScriptKaceComponents ? (
                    <AdminCasesOneScriptKaceComponents />
                ) : (
                    <AdminCaseForm />
                )}
            </TabsContent>
            <TabsContent
                value="customer"
                {...(!refreshCustomer && { forceMount: true })}
                className={tabPanelClassScroll}
            >
                <AdminCaseClient />
            </TabsContent>
            <TabsContent
                value="transitions"
                {...(!refreshTransitions && { forceMount: true })}
                className={tabPanelClassScroll}
            >
                <AdminCaseTransitions />
            </TabsContent>
            <TabsContent
                value="sub-cases"
                {...(!refreshSubcases && { forceMount: true })}
                className={tabPanelClassScroll}
            >
                <AdminCaseSubCases />
            </TabsContent>
            <TabsContent
                value="comments"
                {...(!refreshComments && { forceMount: true })}
                className={tabPanelClassScroll}
            >
                <AdminCaseComments />
            </TabsContent>
            <TabsContent value="agenda" {...(!refreshAgenda && { forceMount: true })} className={tabPanelClassScroll}>
                <AdminCasesCalendar />
            </TabsContent>
            <TabsContent value="logs" {...(!refreshLogs && { forceMount: true })} className={tabPanelClassScroll}>
                <AdminCaseLogs casesData={casesData} allowedEventTypes={cases?.allowed_event_types} />
            </TabsContent>
            <TabsContent
                value="interactions"
                {...(!refreshInteractions && { forceMount: true })}
                className={tabPanelClassScroll}
            >
                <AdminCaseInteractions isActive={activeTab === "interactions"} />
            </TabsContent>
            <TabsContent
                value="notifications"
                {...(!refreshNotifications && { forceMount: true })}
                className={tabPanelClassScroll}
            >
                <AdminCaseNotifications />
            </TabsContent>
        </Tabs>
    );
};

export default AdminCaseTabContainer;
