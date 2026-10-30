import { Formik } from "formik";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import InputCard from "@/components/core/Cards/InputCard";
import ModalForm from "@/components/core/ModalForm/modal-form";
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";
import { DefinitionSchemaForm } from "@/schemas/DefinitionsSchemaForm";
import { WS_REST_FLOWS_SERVICE } from "@/utils/URL";
import { joiFormikAdapter } from "@/utils/main";
import { useDefinitions } from "../hooks/useDefinitions";
import { InputForm as Input, KField } from "@/components/ui-shared";
import { generateAuxTableFields } from "../utils/parseFormData";
import { SelectByUrl } from "@/components/core/SelectByUrl/SelectByUrl";
import { INITIAL_VALUES_DEFINITIONS } from "../constants";
import SchemaSelectField from "@kace_v2/shared/ui/organisms/SchemaSelectField";

const DefinitionsForm = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState(INITIAL_VALUES_DEFINITIONS);

    const openModal = useSelector((state) => state.modalBehavior?.open);
    const id = useSelector((state) => state.modalBehavior?.idSelected);
    const isCreate = !id;

    const { dataHandler, data, isLoading, isPending } = useDefinitions();

    useEffect(() => {
        if (data && openModal) {
            if (Object.entries(data).length !== 0) {
                Object.entries(data).forEach(([key, value]) => {
                    setFormData((state) => ({
                        ...state,
                        [key]: value || "",
                    }));
                });
            }
        }
    }, [data, openModal]);

    useEffect(() => {
        !openModal && setFormData(INITIAL_VALUES_DEFINITIONS);
    }, [openModal]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(DefinitionSchemaForm(t, isCreate))}
            onSubmit={async (values, { setErrors, setStatus }) => {
                if (id) {
                    delete values.name;
                    delete values.tablename;
                    delete values.logs_tablename;
                }
                dataHandler(values, setErrors, setStatus);
            }}
        >
            {({ errors, status, setStatus, resetForm, values, setFieldValue, touched }) => {
                if (Object.entries(errors)?.length === 0 && status !== undefined) {
                    setStatus(undefined);
                }
                // NO-SONAR: se requiere utilizar el hook con la funcion setFieldValue de Formik
                useEffect(() => {
                    if (values.name) {
                        const { tablename, logstable } = generateAuxTableFields(values.name);
                        setFieldValue("tablename", tablename);
                        setFieldValue("logs_tablename", logstable);
                    }
                }, [values.name, setFieldValue]);

                return (
                    <ModalForm
                        open={openModal}
                        loading={isLoading}
                        title={t("navbar.definitions")}
                        subtitle={t("app.forms.subtitle")}
                        resetForm={resetForm}
                        isLoading={isLoading}
                        pending={isPending}
                        hasEntity={id}
                        sizeBig
                    >
                        <div className="flex flex-col justify-content-center gap-6">
                            <InputCard>
                                <KField>
                                    <Input
                                        type="text"
                                        name="name"
                                        label={`${t("oneScript.form.name")} *`}
                                        placeholder={`${t("oneScript.form.name")} `}
                                        className="flex flex-col items-start justify-start text-start"
                                        disabled={Boolean(id)}
                                    />
                                </KField>
                            </InputCard>

                            <div className="flex flex-col gap-4 justify-start">
                                <InputCard className="col-start-2 col-end-5">
                                    <SchemaSelectField
                                        value={values?.schema_id}
                                        pageSize={100}
                                        onChange={(selected) => selected && setFieldValue("schema_id", selected)}
                                        error={touched?.schema_id ? errors.schema_id : undefined}
                                    />
                                </InputCard>
                            </div>
                            <div className="flex flex-col gap-4 justify-start">
                                <InputCard className="col-start-2 ">
                                    <SelectByUrl
                                        name="restflow_id"
                                        url={WS_REST_FLOWS_SERVICE}
                                        itemLabel="description"
                                        value={values?.restflow_id}
                                        label={`${t("app.title.restFlow")}`}
                                        setFieldValue={setFieldValue}
                                        error={errors.restflow_id}
                                        touched={touched.restflow_id}
                                        keyQuery="restflowIdRequest"
                                        filtro={[
                                            { field: "is_active", operator: "eq", value: 1, type: "AND" },
                                            { field: "is_primary", operator: "eq", value: "true", type: "AND" },
                                        ]}
                                    />
                                </InputCard>
                            </div>

                            <InputCard>
                                <KField>
                                    <Input
                                        type="text"
                                        name="tablename"
                                        label={`${t("app.forms.tableName")}`}
                                        placeholder={`${t("app.forms.tableName")}`}
                                        className="flex flex-col items-start justify-start text-start"
                                        readOnly
                                        disabled
                                    />
                                </KField>
                            </InputCard>

                            <InputCard>
                                <KField>
                                    <Input
                                        type="text"
                                        name="logs_tablename"
                                        label={`${t("app.forms.logstable")}`}
                                        placeholder={`${t("app.forms.logstable")}`}
                                        className="flex flex-col items-start justify-start text-start"
                                        readOnly
                                        disabled
                                    />
                                </KField>
                            </InputCard>

                            <InputCard>
                                <KField>
                                    <SwitchStateAdmin
                                        name="is_active"
                                        title={`${t("aux_definitions.form.statusDefinition")} *`}
                                        tipo="boolean"
                                    />
                                </KField>
                            </InputCard>
                        </div>
                    </ModalForm>
                );
            }}
        </Formik>
    );
};

DefinitionsForm.propTypes = {};

export default DefinitionsForm;
