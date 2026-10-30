import { Form, Formik } from "formik";
import FormCard from "../../../components/core/Cards/FormCard";
import SectionForm from "../../../components/core/Cards/section-form";
import InputCard from "../../../components/core/Cards/InputCard";
import { InputForm as Input, KField, SelectByProvider } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useLocation } from "react-router-dom";
import { AUTOMATION_SETTINGS_SERVICE, MAIL_ACCOUNTS_SERVICE } from "@kace/urls";
import {
    ACTION_TYPE_VALUE,
    ENTITIES_OPTIONS,
    INITIAL_VALUES_ACTIONS,
    LIST_BY_FORM,
    VALUELESS_OPERATORS,
} from "../data/constants";
import { joiFormikAdapter } from "@kace/utils";
import { BuilderContainer } from "./builderComponents/BuilderContainer";
import { PriorityContainer } from "./PriorityContainer";
import { TriggersContainer } from "./TriggersContainer";
import { PermissionsActionsContainer } from "./PermissionsActionsContainer";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { ActionSchemaForm } from "../../../schemas/ActionSchema";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import useUserInformation from "../../../hooks/useUserInformation";
import SelectFromQuery from "@/componentsV2/lib/SelectFromQuery";
import { Select } from "@/components/ui-shared/src/components/Select/Select";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import { useTemplates } from "../hooks/useActionTemplate";

const INPUT_BY_FORM = {
    asignar_grupo_por_codigo_externo: {
        name: "external_group_code",
        label: "actions.labels.groupByExternalCode",
    },
    asignar_usuario_por_codigo_externo: {
        name: "external_user_code",
        label: "actions.labels.userByExternalCode",
    },
};

const removeEmptyProperties = (obj) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([key, value]) => {
            if (typeof value === "boolean") {
                return true;
            }
            if (Array.isArray(value)) {
                return true;
            }
            if (typeof value === "number") {
                return true;
            }
            if (typeof value === "string" && value !== "") {
                return true;
            }
            if (typeof value === "object" && value !== null && Object.keys(value).length > 0) {
                return true;
            }
            return false;
        }),
    );
};

const isRuleIncomplete = (rule) => {
    if (rule.field === "") return true;
    if (VALUELESS_OPERATORS.includes(rule.operator)) return false;
    return rule.value === "" || rule.value_type === "" || rule.type === "";
};

const validateThereAreRules = (conditions, t) => {
    if (!conditions || !Array.isArray(conditions.rules)) return t("actions.messages.minRuleRequired");

    let message = null;

    const checkRules = (rules) => {
        for (const rule of rules) {
            if (Array.isArray(rule.rules)) {
                const result = checkRules(rule.rules);
                if (result) return result;
            } else {
                if (isRuleIncomplete(rule)) {
                    return t("actions.messages.incompleteRules");
                }
            }
        }
        return null;
    };

    const totalRules = flattenRules(conditions.rules);

    if (totalRules.length === 0) {
        message = t("actions.messages.minRuleRequired");
    } else if (totalRules.length === 1) {
        if (isRuleIncomplete(totalRules[0])) {
            message = t("actions.messages.minRuleRequired");
        }
    } else {
        message = checkRules(conditions.rules);
    }

    return message;
};

const flattenRules = (rules) => {
    return rules.reduce((acc, rule) => {
        if (Array.isArray(rule.rules)) {
            acc.push(...flattenRules(rule.rules));
        } else {
            acc.push(rule);
        }
        return acc;
    }, []);
};

export const ActionForm = ({ dataHandler, data = {}, isSending = false }) => {
    const [formValues, setFormValues] = useState(INITIAL_VALUES_ACTIONS);
    const [listGroups, setListGroups] = useState([]);
    const [includeUsers, setIncludeUsers] = useState([]);
    const [excludeUsers, setExcludeUsers] = useState([]);
    const [permissions, setPermissions] = useState({});
    const [rules, setRules] = useState({
        combinator: "and",
        rules: [
            {
                combinator: "and",
                not: false,
                rules: [{ field: "", operator: "=", type: "", value: "", value_type: "" }],
            },
        ],
    });
    const location = useLocation();
    const { t } = useTranslation();
    const { user } = useUserInformation();
    const { title, valueForm } = location.state || {};

    const {
        templatesOptions,
        isLoadingTemplates,
        fetchNextTemplates,
        hasNextPageTemplates,
        isFetchingNextPageTemplates,
        onSearchTemplates,
    } = useTemplates();

    const assignValuesAsAppropriate = (values = {}) => {
        if (values.action_type === ACTION_TYPE_VALUE.ongoingAdvisor) {
            values.responsible_id = user.id;
        }
        if (values.action_type === ACTION_TYPE_VALUE.ongoingGroup) {
            values.group_id = user.selectedGroup;
        }
        return values;
    };

    useEffect(() => {
        if (data) {
            const actionType = data.action_type;

            const updatedValueForm =
                valueForm || Object.keys(ACTION_TYPE_VALUE).find((key) => ACTION_TYPE_VALUE[key] === actionType);

            const newData = {
                ...data,
                action_type: ACTION_TYPE_VALUE[updatedValueForm],
            };
            setPermissions(data.permissions);
            setRules(data.conditions);
            setFormValues(newData);
        }
    }, [data, valueForm]);

    useEffect(() => {
        const type = ACTION_TYPE_VALUE[valueForm];
        setFormValues((prev) => {
            return { ...prev, action_type: type };
        });
    }, [valueForm]);
    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(ActionSchemaForm)}
            onSubmit={(values) => {
                values.conditions = rules;
                const message = validateThereAreRules(values.conditions, t);
                if (message) {
                    toast.warning(message);
                    return;
                }
                const valuesWithNewFields = assignValuesAsAppropriate(values);
                const filterValues = removeEmptyProperties(valuesWithNewFields);
                values.permissions.blackList.grupos = listGroups.map((item) => item.id);
                values.permissions.blackList.usuarios = excludeUsers.map((item) => item.id);
                values.permissions.whiteList.usuarios = includeUsers.map((item) => item.id);
                if (!values?.triggers?.includes("cron_job")) {
                    filterValues.automation_id = null;
                }
                dataHandler(filterValues);
            }}
        >
            {({ values, setFieldValue, errors, touched, initialValues }) => {
                return (
                    <Form className="flex w-full justify-center h-full overflow-auto" autoComplete="off">
                        <FormCard isId={!!data?.id} isSending={isSending} title={t(title)}>
                            <div className="flex flex-col col-span-3 gap-8 h-full">
                                <SectionForm tittle={t("actions.tittle.information")}>
                                    {(values.action_type === ACTION_TYPE_VALUE.sendEmail ||
                                        values.action_type === ACTION_TYPE_VALUE.webServiceConsumption) && (
                                        <InputCard>
                                            <KField>
                                                <Select label="Entidad" name="entity" options={ENTITIES_OPTIONS} />
                                            </KField>
                                        </InputCard>
                                    )}
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="description"
                                                label={t("actions.form.description")}
                                                placeholder={t("actions.placeholder.description")}
                                                className="flex flex-col items-start justify-start text-start mx-2 mb-2"
                                                data-testid="input_description"
                                            />
                                        </KField>
                                    </InputCard>
                                    {LIST_BY_FORM[values.action_type] && (
                                        <SelectFromQuery
                                            t={t}
                                            value={values[LIST_BY_FORM[values.action_type].field]}
                                            name={LIST_BY_FORM[values.action_type].field}
                                            setFieldValue={setFieldValue}
                                            errorData={errors[LIST_BY_FORM[values.action_type].field]}
                                            wasTouched={touched[LIST_BY_FORM[values.action_type].field]}
                                            url={LIST_BY_FORM[values.action_type].url}
                                            labelField={LIST_BY_FORM[values.action_type].labelFrom}
                                            queryKey={["actionsOptions"]}
                                            label={LIST_BY_FORM[values.action_type].label}
                                            auxiliary={LIST_BY_FORM[values.action_type].auxiliary}
                                            filter={LIST_BY_FORM[values.action_type].filter ?? []}
                                            pageSize={LIST_BY_FORM[values.action_type].pageSize ?? 0}
                                        />
                                    )}
                                    {values.action_type === "supportModel" && (
                                        <InputCard className="px-2">
                                            <SelectByProvider
                                                name="backrestModel"
                                                url={null}
                                                valueFrom="id"
                                                labelFrom="descripcion"
                                                label={t("actions.form.modelBackup")}
                                                className="flex flex-col gap-2"
                                                id="select_model_backup"
                                                data-testid="select_model_backup"
                                            />
                                        </InputCard>
                                    )}
                                    {INPUT_BY_FORM[values.action_type] && (
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    type="text"
                                                    name={INPUT_BY_FORM[values.action_type].name}
                                                    label={t(INPUT_BY_FORM[values.action_type].label)}
                                                    placeholder={t("actions.placeholder.enterValue")}
                                                    className="flex flex-col items-start justify-start text-start mx-2 mb-2"
                                                    data-testid={`input_${INPUT_BY_FORM[values.action_type]?.name}`}
                                                />
                                            </KField>
                                        </InputCard>
                                    )}
                                    <InputCard className="px-2">
                                        <TriggersContainer
                                            setFieldValue={setFieldValue}
                                            valueField={values.triggers}
                                            name="triggers"
                                        />
                                    </InputCard>
                                    <InputCard className="px-2">
                                        <PriorityContainer
                                            setFieldValue={setFieldValue}
                                            valueField={values.priority}
                                            name="priority"
                                        />
                                    </InputCard>
                                </SectionForm>
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                {values.action_type === "envio_correo" && (
                                    <SectionForm
                                        tittle="Asociaciones"
                                        id="section_associations"
                                        data-testid="section_associations"
                                    >
                                        <InputCard className="px-2" id="account_mail" data-testid="account_mail">
                                            <SelectFromQuery
                                                name="mail_account_id"
                                                value={values.mail_account_id ?? ""}
                                                setFieldValue={setFieldValue}
                                                url={`${MAIL_ACCOUNTS_SERVICE}/search`}
                                                labelField="description"
                                                queryKey={["actionMailAccount"]}
                                                label={t("actions.form.mailAccount")}
                                                errorData={errors.mail_account_id}
                                                wasTouched={touched.mail_account_id}
                                            />
                                        </InputCard>
                                        <InputCard className="px-2" id="template_id" data-testid="template_id">
                                            <SelectField
                                                label={t("actions.form.templates")}
                                                options={templatesOptions}
                                                defaultValue={initialValues?.template_id || ""}
                                                value={values?.template_id || ""}
                                                error={errors.template_id}
                                                onValueChange={(value) => setFieldValue("template_id", value)}
                                                isLoading={isLoadingTemplates}
                                                fetchNextPage={fetchNextTemplates}
                                                hasNextPage={hasNextPageTemplates}
                                                isFetchingNextPage={isFetchingNextPageTemplates}
                                                onSearch={onSearchTemplates}
                                            />
                                        </InputCard>
                                    </SectionForm>
                                )}
                                {values?.triggers?.includes("cron_job") && (
                                    <SectionForm className="w-full">
                                        <InputCard className="px-2">
                                            <SelectFromQuery
                                                name="automation_id"
                                                value={values.automation_id ?? ""}
                                                setFieldValue={setFieldValue}
                                                url={`${AUTOMATION_SETTINGS_SERVICE}/search`}
                                                labelField="description"
                                                queryKey={["actionAutomation"]}
                                                label={t("actions.form.automation")}
                                                errorData={errors.automation_id}
                                                wasTouched={touched.automation_id}
                                            />
                                        </InputCard>
                                    </SectionForm>
                                )}
                                <SectionForm className="w-full">
                                    <InputCard>
                                        <KField>
                                            <SwitchStateAdmin
                                                name="is_active"
                                                shouldBool
                                                id="switch_is_active"
                                                data-testid="switch_is_active"
                                            />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                            </div>
                            <div className="flex flex-col col-span-5">
                                <SectionForm
                                    tittle={t("actions.title.conditionAction")}
                                    id="condition_section"
                                    dataTestId="condition_section"
                                >
                                    <BuilderContainer setFieldValue={setRules} value={rules} />
                                </SectionForm>
                            </div>
                            <div className="flex flex-col col-span-5">
                                <SectionForm tittle={t("actions.title.permissions")}>
                                    <PermissionsActionsContainer
                                        listGroups={listGroups}
                                        setListGroups={setListGroups}
                                        includeUsers={includeUsers}
                                        setIncludeUsers={setIncludeUsers}
                                        excludeUsers={excludeUsers}
                                        setExcludeUsers={setExcludeUsers}
                                        values={permissions}
                                    />
                                </SectionForm>
                            </div>
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};

ActionForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    availableNodes: PropTypes.array,
    nodes: PropTypes.array,
    edges: PropTypes.array,
    isSending: PropTypes.bool,
    title: PropTypes.string,
};
