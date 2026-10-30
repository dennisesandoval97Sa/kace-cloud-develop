import { Button } from "@kace/ui-shared";
import { ChevronLeft, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import useAdminCaseParams from "./hooks/useAdminCaseParams";
import useAdminCaseCase from "./hooks/useAdminCaseCase";
import AdminCaseTabContainer from "./components/AdminCaseTabContainer";
import useAdminCaseCacheData from "./hooks/useAdminCaseCacheData";
import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useBlocker } from "react-router-dom";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useUserInformation from "@/hooks/useUserInformation";
import { NavigationBlockerProvider, useNavigationBlocker } from "@/context/NavigationBlockerContext";
import { isUnloadBypassArmedForForcedSessionEnd } from "@/utils/kaceSessionUnloadBypass";
import { getCaseCodeSuffix } from "@/utils/caseCode";

const AdminCasePageInner = () => {
    const { shouldBlockRef } = useNavigationBlocker();
    const { t } = useTranslation();
    const { extraParam, caseId, navigateToPath, parentId } = useAdminCaseParams();
    const { casesData, caseDataLoading } = useAdminCaseCase(caseId);
    const { handleCacheData } = useAdminCaseCacheData();
    const location = useLocation();
    const navigation = useNavigate();
    const { cases: configCases, agent_filter_subcases_only } = useConfigAgentData();
    const { permissionsAgent } = useUserInformation();

    const showSubcaseButton = configCases?.show_subcases_button;

    const canCreateCase = useMemo(
        () => permissionsAgent.find((item) => item.name === "CasesCreate")?.granted,
        [permissionsAgent],
    );

    const isCreatingSubcase = useMemo(() => extraParam === "create" && !!parentId, [extraParam, parentId]);
    const isSubcase = useMemo(() => !!casesData?.parent_id, [casesData?.parent_id]);

    const { data: parentCaseDataFromSubcase } = useGenericViewQuery({
        keyQuery: [URL_AND_KEYS.cases.byCaseId, casesData?.parent_id],
        searchById: casesData?.parent_id,
        url: `${URL_AND_KEYS.cases.url}/${casesData?.parent_id}`,
        enabled: !!casesData?.parent_id,
    });

    const { data: parentCaseDataFromCreate } = useGenericViewQuery({
        keyQuery: [URL_AND_KEYS.cases.byCaseId, parentId],
        searchById: parentId,
        url: `${URL_AND_KEYS.cases.url}/${parentId}`,
        enabled: isCreatingSubcase && !!parentId,
    });

    const parentCaseData = useMemo(() => {
        return parentCaseDataFromSubcase || parentCaseDataFromCreate;
    }, [parentCaseDataFromSubcase, parentCaseDataFromCreate]);

    const handleNavigateToParentCase = () => {
        const parentIdToNavigate = parentCaseData?.id || parentId;
        if (parentIdToNavigate) {
            const isAgentView = location.pathname.includes("/agent");
            const route = isAgentView
                ? `/agent/update/${parentIdToNavigate}?action=edit`
                : `/cases/update/${parentIdToNavigate}`;
            navigation(route);
        }
    };

    const showSubcase = useMemo(
        () =>
            configCases?.case_enable_subcases &&
            canCreateCase &&
            !caseDataLoading &&
            casesData &&
            !casesData.parent_id &&
            !parentId,
        [configCases?.case_enable_subcases, canCreateCase, parentId, casesData, caseDataLoading],
    );

    const showLinkToParentCase = useMemo(() => {
        const isAgentView = location.pathname.includes("/agent");
        if (isAgentView) {
            return (isSubcase || isCreatingSubcase) && parentCaseData?.reference && !agent_filter_subcases_only;
        }
        return (isSubcase || isCreatingSubcase) && parentCaseData?.reference;
    }, [isSubcase, isCreatingSubcase, parentCaseData?.reference]);

    const title = useMemo(
        () =>
            extraParam === "create"
                ? !parentId
                    ? "app.title.createCase"
                    : "app.title.createSubcase"
                : "app.title.caseDetail",
        [extraParam, parentId],
    );

    const blocker = useBlocker(() => shouldBlockRef.current);

    useEffect(() => {
        shouldBlockRef.current = true;
    }, [location.key]);

    useEffect(() => {
        if (blocker.state === "blocked") {
            const confirmed = window.confirm(t("case.text.confirmLeave"));
            if (confirmed) {
                blocker.proceed();
            } else {
                blocker.reset();
            }
        }
    }, [blocker.state]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isUnloadBypassArmedForForcedSessionEnd()) return;
            if (!shouldBlockRef.current) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    useEffect(() => {
        return () => {
            handleCacheData();
        };
    }, []);

    return (
        <div key={location.key} className="relative flex h-full min-h-0 flex-col gap-2">
            <header className="flex w-full shrink-0 items-center gap-4">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                        handleCacheData();
                        navigateToPath(casesData?.cliente_id);
                    }}
                    id="btn_admin_case_page"
                    data-testid="bbtn_admin_case_page"
                >
                    <ChevronLeft />
                </Button>
                <h2 className="font-bold text-2xl p-2 w-full max-sm:text-base flex items-center gap-2">
                    {t(title, {
                        reference: casesData?.reference || "",
                        externalCode: getCaseCodeSuffix(casesData),
                    })}
                    {showLinkToParentCase && (
                        <span className="text-gray-500 font-normal text-lg">
                            <span className="mx-1">-</span>
                            <button
                                type="button"
                                onClick={handleNavigateToParentCase}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                            >
                                {t("case.text.principalCase")} {parentCaseData.reference}
                                {getCaseCodeSuffix(parentCaseData)}
                            </button>
                        </span>
                    )}
                </h2>
                {showSubcase && showSubcaseButton && (
                    <Button
                        className="h-10 flex gap-1 bg-blueCustom hover:bg-blueCustom/90"
                        onClick={() => {
                            handleCacheData();
                            navigation(
                                `/agent/create/${casesData.cliente_id}?action=create&parent_id=${casesData.id}`,
                                { replace: true, preventScrollReset: true, state: casesData },
                            );
                        }}
                    >
                        <PlusIcon width={22} height={22} />
                        <p className="max-sm:hidden">{t("app.button.newSubcases")}</p>
                    </Button>
                )}
            </header>
            <div className="flex min-h-0 flex-1 flex-col">
                <AdminCaseTabContainer />
            </div>
        </div>
    );
};

const AdminCasePage = () => (
    <NavigationBlockerProvider>
        <AdminCasePageInner />
    </NavigationBlockerProvider>
);

export default AdminCasePage;
