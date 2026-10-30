import { Formik } from "formik";
import { useTranslation } from "react-i18next";
import InputCard from "../../../components/core/Cards/InputCard";
import ModalForm from "../../../components/core/ModalForm/modal-form";
import { OneScriptSchemaForm } from "../../../schemas/OneScriptSchema";
import { useEffect, useMemo, useRef, useState } from "react";
import { KField, InputForm as Input, ScrollArea, Button } from "@kace/ui-shared";
import { joiFormikAdapter } from "../../../utils/main";
import { FormOneScript } from "../../../components/core/FormOneScript/FormOneScript";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";
import { INITIAL_VALUES_ONE_SCRIPT } from "../data/ConstantsOneScript";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useGenericViewQuery from "../../../hooks/useGenericViewQuery";
import { useSelector } from "react-redux";
import SelectFromQuery from "@/componentsV2/lib/SelectFromQuery";
import { toast } from "sonner";
import { useOneScriptIframeHandshake } from "@kace_v2/shared/hooks/useOneScriptIframeHandshake";
import { useOneScriptHandshakeConfig } from "@kace_v2/shared/hooks/useOneScriptHandshakeConfig";

export const OneScriptForm = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState(INITIAL_VALUES_ONE_SCRIPT);
    const openModal = useSelector((state) => state.modalBehavior.open);
    const idSelected = useSelector((state) => state.modalBehavior.idSelected);
    const [viewForm, setViewForm] = useState(false);
    const formRefOneScript = useRef(null);
    const { baseParams, handshakeTokens } = useOneScriptHandshakeConfig();

    const handshakeParams = useMemo(
        () => ({ ...baseParams, case_id: null, client_id: null, parent_id: null }),
        [baseParams],
    );

    useOneScriptIframeHandshake(formRefOneScript, {
        enabled: viewForm,
        params: handshakeParams,
        tokens: handshakeTokens,
    });
    const formikRef = useRef(null);
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.oneScript.key,
        openModal: true,
    });
    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.oneScript.url}/${idSelected}`,
        keyQuery: URL_AND_KEYS.oneScript.key,
        searchById: [idSelected],
        staleTime: 0,
        gcTime: 0,
        enabled: !!idSelected,
    });

    const handleOneScript = async (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: URL_AND_KEYS.oneScript.url,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };

    useEffect(() => {
        if (data && openModal) {
            if (Object.entries(data).length !== 0) {
                const nextValues = { ...INITIAL_VALUES_ONE_SCRIPT };
                Object.entries(data).forEach(([key, value]) => {
                    nextValues[key] = value ?? "";
                });
                setFormData(nextValues);
                formikRef.current?.resetForm({ values: nextValues });
            }
        }
    }, [data, openModal]);

    useEffect(() => {
        if (!openModal) {
            setFormData(INITIAL_VALUES_ONE_SCRIPT);
            formikRef.current?.resetForm({ values: INITIAL_VALUES_ONE_SCRIPT });
            setViewForm(false);
        }
    }, [openModal]);

    return (
        <Formik
            innerRef={formikRef}
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(OneScriptSchemaForm)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                handleOneScript(values, setErrors, setStatus);
            }}
        >
            {({ errors, status, setStatus, resetForm, values, setFieldValue, touched }) => {
                if (Object.entries(errors)?.length === 0 && status !== undefined) {
                    setStatus(undefined);
                }
                return (
                    <ModalForm
                        open={openModal}
                        isLoading={isLoading}
                        title={t("app.title.oneScript")}
                        subtitle={t("app.forms.subtitle")}
                        resetForm={resetForm}
                        pending={isPending}
                        hasEntity={idSelected}
                    >
                        {values?.id && (
                            <InputCard>
                                <div
                                    className="grid grid-cols-1 cursor-pointer select-text"
                                    onClick={() => {
                                        try {
                                            navigator.clipboard.writeText(values.id);
                                            toast.success(t("oneScript.form.idCopied"));
                                        } catch (err) {
                                            //ignore
                                        }
                                    }}
                                >
                                    <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2">
                                        {t("oneScript.form.id")}
                                    </span>
                                    <span
                                        style={{ backgroundColor: "rgba(42, 157, 144, 0.44)" }}
                                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0"
                                    >
                                        {values.id}
                                    </span>
                                </div>
                            </InputCard>
                        )}
                        <InputCard>
                            <KField>
                                <Input
                                    type="text"
                                    name="name"
                                    label={`${t("oneScript.form.name")} *`}
                                    placeholder={`${t("oneScript.form.name")}`}
                                    className="flex flex-col items-start justify-start text-start"
                                />
                            </KField>
                        </InputCard>
                        <InputCard>
                            <KField>
                                <Input
                                    type="text"
                                    name="url_api"
                                    label={`${t("oneScript.form.url_api")} *`}
                                    placeholder={`${t("app.text.UrlByApi")}`}
                                    className="flex flex-col items-start justify-start text-start"
                                />
                            </KField>
                        </InputCard>
                        <InputCard>
                            <KField>
                                <Input
                                    type="text"
                                    name="url"
                                    label={`${t("oneScript.form.url")} *`}
                                    placeholder={`${t("app.text.UrlByOneScript")}`}
                                    className="flex flex-col items-start justify-start text-start"
                                />
                            </KField>
                        </InputCard>
                        <InputCard>
                            <KField>
                                <Input
                                    type="text"
                                    name="onescript_reference_id"
                                    label={`${t("oneScript.form.form_id")} *`}
                                    placeholder={`${t("oneScript.form.form_id")} *`}
                                    className="flex flex-col items-start justify-start text-start"
                                />
                            </KField>
                        </InputCard>
                        <InputCard>
                            <SelectFromQuery
                                name="schema_id"
                                label={t("oneScript.form.schema")}
                                value={values.schema_id ?? data?.schema_id ?? ""}
                                setFieldValue={setFieldValue}
                                errorData={errors.schema_id}
                                wasTouched={touched.schema_id}
                                url={`${URL_AND_KEYS.schemas.url}/search`}
                                labelField="name"
                                queryKey={[URL_AND_KEYS.schemas.key, "onescript"]}
                                pageSize={20}
                            />
                        </InputCard>
                        <InputCard>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setViewForm(true)}
                                disabled={!values.url || !values.url_api}
                                data-testid="btn_onescript_preview"
                                id="btn_onescript_preview"
                            >
                                {t("classification.form.button.preview")}
                            </Button>
                        </InputCard>
                        <div className="flex flex-col p-2 mb-2 my-2 border-input border rounded-md justify-between">
                            <ScrollArea className="h-[calc(29vh)] p-2">
                                {viewForm ? (
                                    <FormOneScript formRef={formRefOneScript} url={values.url} />
                                ) : (
                                    <div
                                        className="text-xl italic text-center content-center grid"
                                        id="div_onescript_preview"
                                        data-testid="div_onescript_preview"
                                    >
                                        <h1>{t("oneScript.form.alerts.previewOnescript")}</h1>
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </ModalForm>
                );
            }}
        </Formik>
    );
};
