import useConfigAgentData from "@kace/hooks/useConfigAgentData";
import { Uuid } from "@kace/plugins";
import { Button, cn } from "@kace/ui-shared";
import { Form, Formik } from "formik";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { INITIAL_VALUES_CASE } from "../data/constants";
import useAdminCaseCacheData from "../hooks/useAdminCaseCacheData";
import useAdminCaseHandleActions from "../hooks/useAdminCaseHandleActions";
import useAdminCaseOSForm from "../hooks/useAdminCaseOSForm";
import useAdminCaseParams from "../hooks/useAdminCaseParams";
import useAdminCasesUserInfo from "../hooks/useAdminCaseUserInfo";
import AdminCaseAttachments from "./AdminCaseAttachments/AdminCaseAttachments";
import AdminCaseClassificationsContainer from "./AdminCaseClassifications/AdminCaseClassificationsContainer";
import AdminCaseOneScript from "./AdminCaseOneScript";
import AdminCaseRichEditor from "./AdminCaseRichEditor";
import AdminCaseStatesContainer from "./AdminCaseStates/AdminCaseStatesContainer";

const AdminCaseForm = () => {
    const { t } = useTranslation();
    const { cases: configCases } = useConfigAgentData();
    const { selectedGroup, responsibleId, userCanEditCase } = useAdminCasesUserInfo();
    const { handleSaveTempCase, handleSaveCase, isPending } = useAdminCaseHandleActions();
    const { caseId, extraParam, userId, parentId } = useAdminCaseParams();
    const { caseCacheData, descriptionCaseCacheData } = useAdminCaseCacheData();
    const newCaseId = useRef(Uuid());
    const newDescriptionId = useRef(Uuid());
    const [componentsStatus, setComponentsStatus] = useState({ classifications: false, states: false });

    const isCreateSubCase = useMemo(() => extraParam === "create" && parentId, [extraParam, parentId]);

    const initialFormValues = useMemo(
        () => ({
            ...INITIAL_VALUES_CASE,
            id: caseId || newCaseId.current,
            clasificacion_id: caseCacheData?.clasificacion_id || "",
            cliente_id: caseCacheData?.cliente_id || userId || "",
            descripcion_caso_id: caseCacheData?.descripcion_caso_id || newDescriptionId.current,
            descripcion_caso: extraParam === "create" ? "" : descriptionCaseCacheData?.descripcion || "",
            grupo_id: caseCacheData?.grupo_id || selectedGroup || "",
            responsable_id: caseCacheData?.responsable_id || responsibleId || "",
            transicion_id: caseCacheData?.transicion_id || "",
            parent_id: parentId,
        }),
        [caseId, extraParam, caseCacheData, descriptionCaseCacheData, isCreateSubCase, parentId],
    );

    const formikValuesRef = useRef({ clasificacion_id: "", id: "" });
    const { oneScriptData, oneScriptUrl, showSendButton } = useAdminCaseOSForm(
        formikValuesRef.current.clasificacion_id,
        formikValuesRef.current.id,
    );

    useEffect(() => {
        localStorage.setItem("isOneScriptUrl", !!oneScriptUrl);
    }, [oneScriptUrl]);

    useEffect(() => {
        return () => {
            localStorage.removeItem("last_transition_id");
        };
    }, []);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={initialFormValues}
            onSubmit={async (values) => {
                if (oneScriptUrl) {
                    await handleSaveTempCase(values);
                    return;
                }

                if (showSendButton) {
                    await handleSaveCase(values);
                }
            }}
        >
            {({ values }) => {
                formikValuesRef.current = { id: values.id, clasificacion_id: values.clasificacion_id };

                return (
                    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
                        <Form
                            className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-4 overflow-y-auto bg-background p-4 drop-shadow-md"
                            autoComplete="off"
                        >
                            <div className="grid grid-cols-1 w-full gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    <div
                                        className={cn("col-span-2 col-start-1", {
                                            "lg:col-start-2": !configCases?.show_attachments,
                                        })}
                                        id="admin_case_classifications_container"
                                        data-testid="admin_case_classifications_container"
                                    >
                                        <AdminCaseClassificationsContainer
                                            handleStatus={() =>
                                                setComponentsStatus({ ...componentsStatus, classifications: true })
                                            }
                                        />
                                    </div>
                                    <div
                                        className="col-span-2"
                                        id="admin_case_states_container"
                                        data-testid="admin_case_states_container"
                                    >
                                        <AdminCaseStatesContainer
                                            flowId={values.flujo_id || ""}
                                            currentTransition={caseCacheData?.transicion_id || values.transicion_id}
                                            handleStatus={() =>
                                                setComponentsStatus({ ...componentsStatus, states: true })
                                            }
                                            statusComponent={componentsStatus}
                                            isOneScript={Boolean(oneScriptUrl)}
                                        />
                                    </div>
                                    {configCases?.show_attachments && (
                                        <div
                                            className="col-span-full lg:col-span-2"
                                            id="admin_case_attachments"
                                            data-testid="admin_case_attachments"
                                        >
                                            <AdminCaseAttachments caseId={values.id} />
                                        </div>
                                    )}
                                </div>
                                {configCases?.show_description && (
                                    <AdminCaseRichEditor
                                        initialValue={initialFormValues.descripcion_caso}
                                        isOSURL={Boolean(oneScriptUrl)}
                                        id="admin_case_rich_editor"
                                        data-testid="admin_case_rich_editor"
                                        componentsStates={componentsStatus.states}
                                    />
                                )}
                                {oneScriptUrl && (
                                    <AdminCaseOneScript
                                        oneScriptName={oneScriptData?.name}
                                        oneScriptUrl={oneScriptUrl}
                                        id="admin_case_one_script"
                                        data-testid="admin_case_one_script"
                                    />
                                )}
                            </div>
                            <div className="flex items-center justify-center w-full">
                                {showSendButton && values.clasificacion_id && (
                                    <Button
                                        className="w-96"
                                        type="submit"
                                        size="lg"
                                        disabled={isPending || !userCanEditCase}
                                        id="btn_admin_case_submit"
                                        data-testid="btn_admin_case_submit"
                                    >
                                        {t(isPending ? "button.sending" : "button.send")}
                                    </Button>
                                )}
                            </div>
                        </Form>
                    </div>
                );
            }}
        </Formik>
    );
};

export default AdminCaseForm;
