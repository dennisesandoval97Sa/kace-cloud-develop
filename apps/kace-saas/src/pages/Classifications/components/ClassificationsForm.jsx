import { PropTypes } from "prop-types";
import { Formik, Form } from "formik";
import { useState } from "react";
import { joiFormikAdapter } from "@kace/utils";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import { ANS_SERVICE, FLOW_SERVICE, GROUP_SERVICE } from "../../../utils/URL";
import { FOLIO_CONFIGURATIONS_SERVICE } from "@/utils/main";
import SectionForm from "../../../components/core/Cards/section-form";
import { InputForm as Input, KField, SelectByProvider } from "@kace/ui-shared";
import { ClassificationSchemaForm } from "../../../schemas/ClassificationSchema";
import { MultiSelectTemplate } from "./MultiSelectTemplate";
import { InputLevels } from "./InputLevels";
import { ListLevels } from "./ListLevels";
import { useTranslation } from "react-i18next";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { normalizeClassificationLevelName } from "../helpers/classificationLevels";

const LEVEL_KEYS = Array.from({ length: 10 }, (_, index) => `nivel${index + 1}`);

const getInitialClassificationData = (data) =>
    Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, key === "is_active" && value === "" ? "false" : value || ""]),
    );

const getInitialLevels = (data) =>
    LEVEL_KEYS.map((key) => data[key]).filter((value) => typeof value === "string" && value.length > 0);

const getDuplicateLevelErrors = (values, message) => {
    const errors = {};
    const firstFieldByName = new Map();

    LEVEL_KEYS.forEach((key) => {
        const value = values[key];
        if (typeof value !== "string" || value.trim().length === 0) return;

        const normalizedName = normalizeClassificationLevelName(value);
        const firstField = firstFieldByName.get(normalizedName);
        if (firstField) {
            errors[firstField] = message;
            errors[key] = message;
            return;
        }
        firstFieldByName.set(normalizedName, key);
    });

    return errors;
};

const trimClassificationLevels = (values) =>
    LEVEL_KEYS.reduce(
        (result, key) => ({
            ...result,
            ...(typeof values[key] === "string" ? { [key]: values[key].trim() } : {}),
        }),
        { ...values },
    );

const getInitialTemplates = (templateIds = [], templateSeed = []) => {
    const selectedIds = new Set(templateIds);
    return templateSeed
        .filter(({ id }) => selectedIds.has(id))
        .map(({ id, descripcion }) => ({
            id,
            label: descripcion,
            value: descripcion,
        }));
};

const ClassificationsForm = ({ dataHandler, data = {}, isSending = false, dataTemplates, templateSeed = [] }) => {
    const { cases: configCases } = useConfigAgentData();
    const [classificationsData] = useState(() => getInitialClassificationData(data));
    const [templates, setTemplates] = useState(() => getInitialTemplates(dataTemplates, templateSeed));
    const [levelList, setLevelList] = useState(() => getInitialLevels(data));
    const { t } = useTranslation();

    return (
        <Formik
            enableReinitialize={true}
            initialValues={classificationsData}
            validationSchema={joiFormikAdapter(ClassificationSchemaForm)}
            validate={(values) => getDuplicateLevelErrors(values, t("classification.form.alerts.sameName"))}
            validateOnMount={true}
            onSubmit={(values) => {
                dataHandler(trimClassificationLevels(values), templates);
            }}
        >
            {({ values, setFieldValue, setValues, errors, touched }) => {
                return (
                    <Form className="flex w-full justify-center" data-testid="formClassification" autoComplete="off">
                        <FormCard isId={data?.id} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8 ">
                                <SectionForm
                                    title={t("classification.form.sectionLevelsTitle")}
                                    isError={errors.nivel1 && Object.keys(touched).length > 0}
                                >
                                    <InputCard>
                                        <InputLevels
                                            setLevels={setLevelList}
                                            levelList={levelList}
                                            setValues={setFieldValue}
                                        />
                                    </InputCard>
                                    <ListLevels
                                        listLevels={levelList}
                                        setLevelList={setLevelList}
                                        setFieldValues={setFieldValue}
                                        setValues={setValues}
                                        values={values}
                                        errors={errors}
                                    />
                                </SectionForm>
                                <SectionForm title={t("classification.form.sectionTemplatesTitle")}>
                                    <MultiSelectTemplate listValues={templates} setListValues={setTemplates} />
                                </SectionForm>
                                {configCases?.case_enable_subcases && (
                                    <SectionForm className="w-full">
                                        <InputCard>
                                            <KField>
                                                <SwitchStateAdmin
                                                    title={t("classification.form.principal")}
                                                    name="can_start_sub_cases_flow"
                                                    tipo="boolean"
                                                />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                )}
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                <SectionForm title={t("classification.form.sectionFlowsTitle")}>
                                    <InputCard>
                                        <SelectByProvider
                                            name="flujo_id"
                                            url={`${FLOW_SERVICE}`}
                                            valueFrom="id"
                                            labelFrom="nombre"
                                            staleTime={0}
                                            enableSearch
                                            enableInfiniteScroll
                                            enableAlphabeticalOrder
                                            clearable
                                            filters={[
                                                {
                                                    field: "status",
                                                    operator: "eq",
                                                    value: 1,
                                                    type: "AND",
                                                },
                                            ]}
                                            id="clasifications_select"
                                            data-testid="clasifications_select"
                                        />
                                    </InputCard>
                                </SectionForm>
                                <SectionForm title={t("classification.form.sectionAnsTitle")}>
                                    <InputCard>
                                        <SelectByProvider
                                            name="ans_id"
                                            url={`${ANS_SERVICE}`}
                                            valueFrom="id"
                                            labelFrom="nombre"
                                            staleTime={0}
                                            enableSearch
                                            enableInfiniteScroll
                                            enableAlphabeticalOrder
                                            clearable
                                        />
                                    </InputCard>
                                </SectionForm>
                                <SectionForm title={t("classification.form.sectionDefaultGroupTitle")}>
                                    <InputCard>
                                        <SelectByProvider
                                            name="default_group_id"
                                            url={`${GROUP_SERVICE}`}
                                            valueFrom="id"
                                            labelFrom="nombre"
                                            staleTime={0}
                                            enableSearch
                                            enableInfiniteScroll
                                            enableAlphabeticalOrder
                                            clearable
                                        />
                                    </InputCard>
                                </SectionForm>
                                <SectionForm title={t("classification.form.sectionFolioConfigTitle")}>
                                    <InputCard>
                                        <SelectByProvider
                                            name="folio_config_id"
                                            url={`${FOLIO_CONFIGURATIONS_SERVICE}`}
                                            valueFrom="id"
                                            labelFrom="nombre"
                                            staleTime={0}
                                            enableSearch
                                            enableInfiniteScroll
                                            enableAlphabeticalOrder
                                            clearable
                                            filters={[
                                                {
                                                    field: "status",
                                                    operator: "eq",
                                                    value: 1,
                                                    type: "AND",
                                                },
                                            ]}
                                            data-testid="classification_folio_config_select"
                                        />
                                    </InputCard>
                                </SectionForm>
                                <div className="flex lg:flex-col gap-4">
                                    <SectionForm
                                        title={t("classification.form.sectionExternalIdTitle")}
                                        className="w-full"
                                    >
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    type="text"
                                                    name="external_id"
                                                    label=""
                                                    placeholder={t("classification.form.sectionExternalIdTitle")}
                                                    className="flex flex-col items-start justify-start text-start mx-2 mb-2"
                                                />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                    {data.id && (
                                        <SectionForm className="w-full">
                                            <InputCard>
                                                <KField>
                                                    <SwitchStateAdmin name="is_active" tipo="boolean" />
                                                </KField>
                                            </InputCard>
                                        </SectionForm>
                                    )}
                                </div>
                            </div>
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};

ClassificationsForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
    dataTemplates: PropTypes.array,
    templateSeed: PropTypes.array,
};
export default ClassificationsForm;
