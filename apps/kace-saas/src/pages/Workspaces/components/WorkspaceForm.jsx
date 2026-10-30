import InputCard from "@/components/core/Cards/InputCard";
import SectionForm from "@/components/core/Cards/section-form";
import { PropTypes } from "prop-types";
import { Form, Formik, FieldArray, Field, useField, useFormikContext } from "formik";
import { FocusFirstInvalidOnSubmit } from "./FocusFirstInvalidOnSubmit";
import { useEffect, useRef, useState } from "react";
import { joiFormikAdapter } from "@kace/utils";
import FormCard from "@/components/core/Cards/FormCard";
import { InputForm as Input, KField } from "@kace/ui-shared";
import { Trash2, Plus } from "lucide-react";
import { MultiSelectChannelHubAccounts } from "@/pages/Workspaces/components/MultiSelectChannelHubAccounts";
import { MultiSelectGroupsWorkspace } from "@/pages/Workspaces/components/MultiSelectGroupsWorkspace";
import { SimpleSelect } from "@/components/core/selectors/SimpleSelect";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { CHANNEL_HUB_EXTERNAL_CODES } from "@/pages/ChannelHub/data/externalCodes";

import { initialValues } from "../data";
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";
import { useTranslation } from "react-i18next";
import { WorkspaceSchemaForm } from "@/schemas/WorkspaceSchema";
import { fieldOptions, operatorOptions } from "../data/constants";
import { isRuleRowComplete, ruleRowsSignature } from "../utils/workspaceRules";

const tagRestFlowFields = [
    {
        name: "tag_creation_flow_id",
        labelKey: "workspace.form.tag_creation_flow",
        placeholderKey: "workspace.placeholder.tag_creation_flow",
        externalCode: CHANNEL_HUB_EXTERNAL_CODES.TAG_CREATE,
    },
    {
        name: "tag_update_flow_id",
        labelKey: "workspace.form.tag_update_flow",
        placeholderKey: "workspace.placeholder.tag_update_flow",
        externalCode: CHANNEL_HUB_EXTERNAL_CODES.TAG_UPDATE,
    },
    {
        name: "tag_deletion_flow_id",
        labelKey: "workspace.form.tag_deletion_flow",
        placeholderKey: "workspace.placeholder.tag_deletion_flow",
        externalCode: CHANNEL_HUB_EXTERNAL_CODES.TAG_DELETE,
    },
];

const tagRestFlowFilter = [
    {
        groupType: "OR",
        filters: tagRestFlowFields.map(({ externalCode }, index) => ({
            field: "external_code",
            operator: "eq",
            value: externalCode,
            type: index === 0 ? "AND" : "OR",
        })),
    },
    {
        field: "is_primary",
        operator: "eq",
        value: 1,
        type: "AND",
    },
    {
        field: "is_active",
        operator: "eq",
        value: 1,
        type: "AND",
    },
    { field: "deleted_at", operator: "null", value: "null", type: "AND" },
];

const mapRestFlowOptions = (data) => {
    const items = data?.data ?? data?.pages?.flatMap((page) => page.data ?? []) ?? [];
    return items
        .filter((flow) => flow?.id)
        .map((flow) => ({
            id: flow.id,
            value: flow.id,
            label: flow.description || flow.label || flow.id,
            external_code: flow.external_code,
        }));
};

const normalizeNullableId = (value) => value || null;

const getRuleKey = (field, operator) => `${field}${operator.charAt(0).toUpperCase() + operator.slice(1)}`;

const transformApiRulesToTableRules = (rules) => {
    if (Array.isArray(rules)) {
        return rules
            .filter((rule) => rule?.field && rule?.operator && Object.prototype.hasOwnProperty.call(rule, "value"))
            .map(({ field, operator, value }) => ({ field, operator, value }));
    }

    if (!rules || typeof rules !== "object") {
        return [];
    }

    return fieldOptions.flatMap(({ value: field }) =>
        operatorOptions.flatMap(({ value: operator }) => {
            const values = rules[getRuleKey(field, operator)];

            if (!Array.isArray(values)) {
                return [];
            }

            return values
                .filter((value) => value !== undefined && value !== null && value !== "")
                .map((value) => ({ field, operator, value }));
        }),
    );
};

const toChannelHubAccountOption = (account, index, descriptions = []) => {
    const id = typeof account === "string" ? account : account?.id;
    const label =
        (typeof account === "object" && (account.email || account.description || account.name || account.label)) ||
        descriptions?.[index] ||
        `Channel Hub Account ${index + 1}`;

    return id
        ? {
              id,
              label,
              value:
                  (typeof account === "object" &&
                      [account.email, account.name, account.description].filter(Boolean).join(" ")) ||
                  label,
          }
        : null;
};

const toGroupOption = (group, index, descriptions = []) => {
    const id = typeof group === "string" ? group : group?.id;
    const label =
        (typeof group === "object" && (group.nombre || group.description || group.descripcion || group.label)) ||
        descriptions?.[index] ||
        `Group ${index + 1}`;

    return id
        ? {
              id,
              label,
              value:
                  (typeof group === "object" &&
                      [group.nombre, group.descripcion, group.description].filter(Boolean).join(" ")) ||
                  label,
          }
        : null;
};

const useRuleCell = (index, column) => {
    const { t } = useTranslation();
    const name = `tableRules.${index}.${column}`;
    const [, meta] = useField(name);

    return {
        name,
        // The column headers are not labels, so each cell is named by its column and row.
        label: `${t(`workspace.table.${column}`)} ${index + 1}`,
        errorId: `workspace_rule_${column}_error_${index}`,
        error: meta.touched && meta.error ? meta.error : undefined,
    };
};

const RuleCellError = ({ id, error }) =>
    error ? (
        <p id={id} role="alert" className="text-sm text-red-600 mt-1" data-testid={id}>
            {error}
        </p>
    ) : null;
RuleCellError.propTypes = {
    id: PropTypes.string.isRequired,
    error: PropTypes.string,
};

const RuleSelectField = ({ index, column, ...selectProps }) => {
    const { name, label, errorId, error } = useRuleCell(index, column);

    return (
        <div>
            <SimpleSelect
                name={name}
                aria-label={label}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                {...selectProps}
            />
            <RuleCellError id={errorId} error={error} />
        </div>
    );
};
RuleSelectField.propTypes = {
    index: PropTypes.number.isRequired,
    column: PropTypes.oneOf(["field", "operator"]).isRequired,
};

const RuleValueField = ({ index, placeholder }) => {
    const { name, label, errorId, error } = useRuleCell(index, "value");

    return (
        <div>
            <Field
                id={`workspace_rule_value_${index}`}
                name={name}
                type="text"
                aria-label={label}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                placeholder={placeholder}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <RuleCellError id={errorId} error={error} />
        </div>
    );
};
RuleValueField.propTypes = {
    index: PropTypes.number.isRequired,
    placeholder: PropTypes.string,
};

// Moves the focus to the first invalid control once a submit attempt is blocked by validation.
// Rule cells already emit `aria-invalid="true"`, but the shared inputs (description, tag) and
// MultiSelectChannelHubAccounts do not — when the error lives there, fall back to the first
// Formik error key by name. `errorsRef` keeps the latest errors out of the effect deps so a
// keystroke that triggers revalidation does not re-run the focus action.

const WorkspaceForm = ({ dataHandler, data = {}, isSending = false }) => {
    const { t } = useTranslation();
    const isEditMode = !!data?.id;
    const translatedFieldOptions = fieldOptions.map(({ value, labelKey }) => ({ value, label: t(labelKey) }));
    const translatedOperatorOptions = operatorOptions.map(({ value, labelKey }) => ({ value, label: t(labelKey) }));
    const [formValues, setFormValues] = useState(initialValues);
    const [channelHubAccountValues, setChannelHubAccountValues] = useState([]);
    const [groupValues, setGroupValues] = useState([]);
    const formRef = useRef(null);

    /*
     * Saving an inactive workspace goes through deactivation, which keeps the persisted rules
     * when none are sent: unchanged rules are neither validated nor sent, so they never block it.
     */
    const keepsPersistedRules = (values) =>
        isEditMode &&
        values.is_active === false &&
        ruleRowsSignature(values.tableRules) === ruleRowsSignature(formValues.tableRules);

    const validationSchema = {
        validate: (values) =>
            joiFormikAdapter(WorkspaceSchemaForm, {
                abortEarly: false,
                allowUnknown: true,
                context: { keepPersistedRules: keepsPersistedRules(values) },
            }).validate(values),
    };

    const { data: restFlowOptions = [], isLoading: isLoadingRestFlows } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.restFlows.url}/search`,
        keyQuery: [URL_AND_KEYS.restFlows.key, "workspace-tag-rest-flows"],
        table: URL_AND_KEYS.restFlows.entity,
        filter: tagRestFlowFilter,
        select: mapRestFlowOptions,
        pageSize: 100,
    });

    const transformRulesToApiFormat = (rules, tag, existingRules = {}) => {
        const result = {
            ruleName: tag || "Rule",
            subjectContains: [],
            subjectEquals: [],
            ccContains: [],
            ccEquals: [],
            fromContains: [],
            fromEquals: [],
            toContains: [],
            toEquals: [],
            bodyContains: [],
            actionRules: {
                classifyAs: tag || "",
            },
        };

        if (existingRules?.ruleId) {
            result.ruleId = existingRules.ruleId;
        }

        rules.forEach((rule) => {
            if (!isRuleRowComplete(rule)) return;

            const { field, operator, value } = rule;

            const key = getRuleKey(field, operator);
            if (result[key]) {
                result[key].push(value);
            }
        });

        return result;
    };

    useEffect(() => {
        if (Object.keys(data).length > 0) {
            setFormValues({
                ...initialValues,
                ...data,
                channel_hub_accounts: data.channel_hub_accounts,
                tableRules: data.tableRules ?? transformApiRulesToTableRules(data.rules),
                tag_creation_flow_id: data.tag_creation_flow_id ?? "",
                tag_update_flow_id: data.tag_update_flow_id ?? "",
                tag_deletion_flow_id: data.tag_deletion_flow_id ?? "",
            });

            if (data?.channel_hub_accounts && Array.isArray(data.channel_hub_accounts)) {
                const accounts = data.channel_hub_accounts
                    .map((account, index) =>
                        toChannelHubAccountOption(account, index, data.channel_hub_account_descriptions),
                    )
                    .filter(Boolean);
                setChannelHubAccountValues(accounts);
            }

            if (data?.groups && Array.isArray(data.groups)) {
                const groups = data.groups
                    .map((group, index) => toGroupOption(group, index, data.group_descriptions))
                    .filter(Boolean);
                setGroupValues(groups);
            }
        }
    }, [data]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={validationSchema}
            onSubmit={(values) => {
                const payload = {
                    ...values,
                    channel_hub_accounts: channelHubAccountValues.map((account) => ({ id: account.id })),
                    groups: groupValues.map((group) => ({ id: group.id })),
                    tag_creation_flow_id: normalizeNullableId(values.tag_creation_flow_id),
                    tag_update_flow_id: normalizeNullableId(values.tag_update_flow_id),
                    tag_deletion_flow_id: normalizeNullableId(values.tag_deletion_flow_id),
                };

                if (Array.isArray(values.tableRules)) {
                    payload.rules =
                        values.tableRules.length > 0
                            ? transformRulesToApiFormat(values.tableRules, values.tag, values.rules)
                            : null;
                }

                if (keepsPersistedRules(values)) {
                    delete payload.rules;
                }

                delete payload.tableRules;
                delete payload.mails_accounts;

                dataHandler(payload);
            }}
        >
            {({ errors, setFieldTouched, setFieldValue }) => {
                const setChannelHubAccountValuesAndFormikValue = (nextValuesOrUpdater) => {
                    const nextValues =
                        typeof nextValuesOrUpdater === "function"
                            ? nextValuesOrUpdater(channelHubAccountValues)
                            : nextValuesOrUpdater;
                    const normalizedValues = Array.isArray(nextValues) ? nextValues : [];

                    setChannelHubAccountValues(normalizedValues);
                    setFieldValue(
                        "channel_hub_accounts",
                        normalizedValues.map((account) => ({ id: account.id })),
                    );
                    setFieldTouched("channel_hub_accounts", true, false);
                };

                return (
                    <Form ref={formRef} className="flex w-full" autoComplete="off">
                        <FocusFirstInvalidOnSubmit formRef={formRef} />
                        <div className="w-full">
                            <FormCard isId={!!data?.id} title={t("app.title.workspaces")} isSending={isSending}>
                                <div className="flex flex-col col-span-3 gap-8">
                                    <SectionForm id="workspace_form" dataTestId="workspace_form">
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    id="description"
                                                    name="description"
                                                    label={t("workspace.form.description")}
                                                    type="text"
                                                    placeholder={t("workspace.placeholder.description")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    id="tag"
                                                    name="tag"
                                                    label={t("workspace.form.tag")}
                                                    type="text"
                                                    placeholder={t("workspace.placeholder.tag")}
                                                    disabled={isEditMode}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <SwitchStateAdmin name="is_active" shouldBool={true} />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <div className="w-full">
                                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                                    {t("workspace.form.rules")}
                                                </label>
                                                <FieldArray name="tableRules">
                                                    {({ push, remove, form }) => (
                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-[200px_200px_1fr_auto] gap-2 font-bold text-sm text-gray-700 pb-2 border-b">
                                                                <div>{t("workspace.table.field")}</div>
                                                                <div>{t("workspace.table.operator")}</div>
                                                                <div>{t("workspace.table.value")}</div>
                                                                <div className="w-10"></div>
                                                            </div>

                                                            {form.values.tableRules &&
                                                            form.values.tableRules.length > 0 ? (
                                                                form.values.tableRules.map((row, index) => {
                                                                    const rowOperatorOptions =
                                                                        row.field === "body"
                                                                            ? translatedOperatorOptions.filter(
                                                                                  (option) => option.value !== "equals",
                                                                              )
                                                                            : translatedOperatorOptions;

                                                                    return (
                                                                        <div
                                                                            key={index}
                                                                            className="grid grid-cols-[200px_200px_1fr_auto] gap-2 items-start"
                                                                        >
                                                                            <RuleSelectField
                                                                                index={index}
                                                                                column="field"
                                                                                options={translatedFieldOptions}
                                                                                placeholder={t(
                                                                                    "workspace.placeholder.field",
                                                                                )}
                                                                                onChange={(value) => {
                                                                                    if (
                                                                                        value === "body" &&
                                                                                        row.operator === "equals"
                                                                                    ) {
                                                                                        form.setFieldValue(
                                                                                            `tableRules.${index}.operator`,
                                                                                            "",
                                                                                        );
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <RuleSelectField
                                                                                index={index}
                                                                                column="operator"
                                                                                options={rowOperatorOptions}
                                                                                placeholder={t(
                                                                                    "workspace.placeholder.operator",
                                                                                )}
                                                                            />
                                                                            <RuleValueField
                                                                                index={index}
                                                                                placeholder={t(
                                                                                    "workspace.placeholder.value",
                                                                                )}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => remove(index)}
                                                                                className="h-10 w-10 flex items-center justify-center text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                                                                title={t(
                                                                                    "workspace.rules.deleteRow",
                                                                                    "Delete row",
                                                                                )}
                                                                            >
                                                                                <Trash2 size={18} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="text-center py-4 text-gray-500 text-sm">
                                                                    {t("workspace.rules.empty", "No rules added")}
                                                                </div>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    push({ field: "", operator: "", value: "" })
                                                                }
                                                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                                                            >
                                                                <Plus size={18} />
                                                                {t("workspace.rules.add", "Add rule")}
                                                            </button>
                                                        </div>
                                                    )}
                                                </FieldArray>
                                            </div>
                                        </InputCard>
                                    </SectionForm>
                                </div>
                                <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                    <SectionForm
                                        title={t("workspace.form.channel_hub_accounts")}
                                        id="workspace_form_mail_account"
                                        dataTestId="workspace_form_mail_account"
                                    >
                                        <InputCard>
                                            <KField>
                                                <MultiSelectChannelHubAccounts
                                                    listValues={channelHubAccountValues}
                                                    setListValues={setChannelHubAccountValuesAndFormikValue}
                                                    enableSearch={true}
                                                    ariaDescribedBy={
                                                        errors.channel_hub_accounts
                                                            ? "workspace_channel_hub_accounts_error"
                                                            : undefined
                                                    }
                                                    ariaInvalid={Boolean(errors.channel_hub_accounts)}
                                                />
                                            </KField>
                                            {errors.channel_hub_accounts && (
                                                <p
                                                    id="workspace_channel_hub_accounts_error"
                                                    role="alert"
                                                    className="text-sm text-red-600 mt-1"
                                                    data-testid="workspace_channel_hub_accounts_error"
                                                >
                                                    {errors.channel_hub_accounts}
                                                </p>
                                            )}
                                        </InputCard>
                                    </SectionForm>
                                    <SectionForm
                                        title={t("workspace.form.groups")}
                                        id="workspace_form_groups"
                                        dataTestId="workspace_form_groups"
                                    >
                                        <InputCard>
                                            <KField>
                                                <MultiSelectGroupsWorkspace
                                                    listValues={groupValues}
                                                    setListValues={setGroupValues}
                                                    enableSearch={true}
                                                />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                    <SectionForm
                                        title={t("workspace.form.tag_rest_flows")}
                                        id="workspace_form_tag_rest_flows"
                                        dataTestId="workspace_form_tag_rest_flows"
                                    >
                                        {tagRestFlowFields.map((field) => {
                                            const fieldRestFlowOptions = restFlowOptions.filter(
                                                (flow) => flow.external_code === field.externalCode,
                                            );

                                            return (
                                                <InputCard key={field.name}>
                                                    <KField>
                                                        <div className="flex flex-col gap-2">
                                                            <label htmlFor={field.name} className="text-sm font-medium">
                                                                {t(field.labelKey)}
                                                            </label>
                                                            <Field
                                                                as="select"
                                                                id={field.name}
                                                                name={field.name}
                                                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                            >
                                                                <option value="">
                                                                    {isLoadingRestFlows
                                                                        ? t("genericTexts.loading")
                                                                        : t(field.placeholderKey)}
                                                                </option>
                                                                {fieldRestFlowOptions.map((flow) => (
                                                                    <option key={flow.id} value={flow.value}>
                                                                        {flow.label}
                                                                    </option>
                                                                ))}
                                                            </Field>
                                                        </div>
                                                    </KField>
                                                </InputCard>
                                            );
                                        })}
                                    </SectionForm>
                                </div>
                            </FormCard>
                        </div>
                    </Form>
                );
            }}
        </Formik>
    );
};
WorkspaceForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};
export default WorkspaceForm;
