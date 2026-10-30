import { Formik, Form, useField, useFormikContext } from "formik";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { joiFormikAdapter } from "@kace/utils";
import { formatTestId } from "@/utils/src/helpers";
import { KField, InputFormModal as Input, FormikStatusMessages } from "@kace/ui-shared";
import FormCard from "@/components/core/Cards/FormCard";
import InputCard from "@/components/core/Cards/InputCard";
import SectionForm from "@/components/core/Cards/section-form";
import { INITIAL_FORM } from "../data/constants";
import { CHANNEL_HUB_EXTERNAL_CODES } from "../data/externalCodes";
import Joi from "joi";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import WorkspacePriorityList from "./WorkspacePriorityList";

const ChannelHubFormSchema = Joi.object({
    id: Joi.string().allow(""),
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),
    name: Joi.string().required(),
    country_id: Joi.string().required(),
    operator_id: Joi.string().valid("imap", "gmail", "microsoft").required(),
    rest_flow_id: Joi.string().uuid().required(),
    mail_rule_list_rest_flow_id: Joi.string().uuid().required(),
    mail_rule_priority_update_rest_flow_id: Joi.string().uuid().required(),
});

const CHANNEL_HUB_OPERATOR_OPTIONS = ["imap", "gmail", "microsoft"];
export const buildRestFlowFamilyFilter = (externalCode, allowVariants = false) => {
    const externalCodeFilters = [{ field: "external_code", operator: "eq", value: externalCode, type: "AND" }];
    if (allowVariants) {
        externalCodeFilters.push(
            { field: "external_code", operator: "like", value: `${externalCode}-%`, type: "OR" },
            { field: "external_code", operator: "like", value: `${externalCode}_%`, type: "OR" },
        );
    }
    return [
        { groupType: "OR", filters: externalCodeFilters },
        { field: "is_primary", operator: "eq", value: 1, type: "AND" },
        { field: "is_active", operator: "eq", value: 1, type: "AND" },
        { field: "deleted_at", operator: "null", value: "null", type: "AND" },
    ];
};

export const CHANNEL_HUB_REGISTRATION_FLOW_FILTER = buildRestFlowFamilyFilter(
    CHANNEL_HUB_EXTERNAL_CODES.CONNECTION,
    true,
);

export const CHANNEL_HUB_REGISTRATION_FLOW_ORDER = { field: "description", direction: "asc" };

export const mapRestFlows = (data) =>
    (data?.data ?? [])
        .filter((flow) => flow?.id)
        .map((flow) => ({
            id: flow.id,
            description: flow.description || flow.external_code || flow.id,
        }));

const getFormValues = (data) => {
    if (!data || Object.keys(data).length === 0) return { ...INITIAL_FORM };
    return Object.keys(INITIAL_FORM).reduce(
        (values, key) => ({
            ...values,
            [key]: data[key] ?? INITIAL_FORM[key],
        }),
        {},
    );
};

const OperatorSelect = ({ disabled = false }) => {
    const { t } = useTranslation();
    const [field, meta, helpers] = useField("operator_id");

    return (
        <div>
            <label htmlFor="operator_id" className="text-sm font-medium">
                {t("channelHub.operator_id")}
            </label>
            <select
                id="operator_id"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={field.value}
                onChange={(e) => helpers.setValue(e.target.value)}
                onBlur={() => helpers.setTouched(true)}
                disabled={disabled}
                data-testid={formatTestId("channel_hub_form", "operator_id")}
            >
                <option value="">{t("channelHub.operator_id")}</option>
                {CHANNEL_HUB_OPERATOR_OPTIONS.map((operator) => (
                    <option key={operator} value={operator}>
                        {t(`channelHub.operators.${operator}`)}
                    </option>
                ))}
            </select>
            {meta.touched && meta.error && <div className="text-red-500 text-xs mt-1">{meta.error}</div>}
        </div>
    );
};

OperatorSelect.propTypes = {
    disabled: PropTypes.bool,
};

const RestFlowSelect = ({
    name,
    label,
    flows,
    disabled = false,
    isLoading = false,
    emptyMessage,
    emptyTestId,
    onValueChange,
}) => {
    const { t } = useTranslation();
    const [field, meta, helpers] = useField(name);
    const hasFlows = flows.length > 0;
    const isDisabled = disabled || isLoading || !hasFlows;
    let placeholder = label;

    if (isLoading) {
        placeholder = t("genericTexts.loading");
    } else if (!hasFlows) {
        placeholder = emptyMessage;
    }

    return (
        <div>
            <label htmlFor={name} className="text-sm font-medium">
                {label}
            </label>
            <select
                id={name}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={field.value}
                onChange={(e) => {
                    const nextValue = e.target.value;
                    onValueChange?.(field.value, nextValue);
                    helpers.setValue(nextValue);
                }}
                onBlur={() => helpers.setTouched(true)}
                disabled={isDisabled}
                data-testid={formatTestId("channel_hub_form", name)}
            >
                <option value="">{placeholder}</option>
                {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                        {flow.description}
                    </option>
                ))}
            </select>
            {!isLoading && !hasFlows && (
                <p className="text-orangeCustom text-xs mt-1" data-testid={emptyTestId}>
                    {emptyMessage}
                </p>
            )}
            {meta.touched && meta.error && <div className="text-red-500 text-xs mt-1">{meta.error}</div>}
        </div>
    );
};

RestFlowSelect.propTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    flows: PropTypes.arrayOf(
        PropTypes.exact({
            id: PropTypes.string.isRequired,
            description: PropTypes.string.isRequired,
        }),
    ).isRequired,
    disabled: PropTypes.bool,
    isLoading: PropTypes.bool,
    emptyMessage: PropTypes.string.isRequired,
    emptyTestId: PropTypes.string.isRequired,
    onValueChange: PropTypes.func,
};

const CreateFlowDefaults = ({ isEditMode, listFlows, priorityUpdateFlows }) => {
    const { setFieldValue, touched, values } = useFormikContext();

    useEffect(() => {
        if (isEditMode) return;
        if (!values.mail_rule_list_rest_flow_id && !touched.mail_rule_list_rest_flow_id && listFlows.length === 1) {
            setFieldValue("mail_rule_list_rest_flow_id", listFlows[0].id, false);
        }
        if (
            !values.mail_rule_priority_update_rest_flow_id &&
            !touched.mail_rule_priority_update_rest_flow_id &&
            priorityUpdateFlows.length === 1
        ) {
            setFieldValue("mail_rule_priority_update_rest_flow_id", priorityUpdateFlows[0].id, false);
        }
    }, [
        isEditMode,
        listFlows,
        priorityUpdateFlows,
        setFieldValue,
        touched.mail_rule_list_rest_flow_id,
        touched.mail_rule_priority_update_rest_flow_id,
        values.mail_rule_list_rest_flow_id,
        values.mail_rule_priority_update_rest_flow_id,
    ]);

    return null;
};

CreateFlowDefaults.propTypes = {
    isEditMode: PropTypes.bool.isRequired,
    listFlows: PropTypes.arrayOf(PropTypes.object).isRequired,
    priorityUpdateFlows: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export const ChannelHubCreateFormView = ({
    dataHandler,
    data = {},
    isSending = false,
    isEditMode = false,
    isReadOnly = false,
    workspacePriorities,
    isLoadingWorkspacePriorities = false,
    isUpdatingWorkspacePriorities = false,
    workspacePrioritiesError,
    onRetryWorkspacePriorities,
    registrationFlows = [],
    listFlows = [],
    priorityUpdateFlows = [],
    isLoadingRegistrationFlows = false,
    isLoadingListFlows = false,
    isLoadingPriorityUpdateFlows = false,
}) => {
    const { t } = useTranslation();

    const [formData, setFormData] = useState(() => getFormValues(data));
    const [priorityItems, setPriorityItems] = useState([]);
    const [isPriorityOrderDirty, setIsPriorityOrderDirty] = useState(false);
    const [isPriorityConfigurationStale, setIsPriorityConfigurationStale] = useState(false);
    const accountIdRef = useRef(data?.id);
    const isPriorityOrderDirtyRef = useRef(false);

    useEffect(() => {
        if (data?.id !== accountIdRef.current) {
            accountIdRef.current = data?.id;
            setFormData(getFormValues(data));
            isPriorityOrderDirtyRef.current = false;
            setIsPriorityOrderDirty(false);
            setIsPriorityConfigurationStale(false);
        }
    }, [data]);

    useEffect(() => {
        if (data?.id !== accountIdRef.current) return;
        if (isPriorityOrderDirtyRef.current) return;
        setPriorityItems(workspacePriorities?.items ?? []);
    }, [data?.id, workspacePriorities]);

    useEffect(() => {
        setIsPriorityConfigurationStale(false);
    }, [data?.id, data?.mail_rule_list_rest_flow_id, data?.mail_rule_priority_update_rest_flow_id]);

    const handlePriorityOrderChange = (nextItems) => {
        setPriorityItems(nextItems);
        isPriorityOrderDirtyRef.current = true;
        setIsPriorityOrderDirty(true);
    };

    const invalidatePriorityConfiguration = (previousValue, nextValue) => {
        if (isEditMode && previousValue !== nextValue) {
            setIsPriorityConfigurationStale(true);
            isPriorityOrderDirtyRef.current = false;
            setIsPriorityOrderDirty(false);
            setPriorityItems([]);
        }
    };

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(ChannelHubFormSchema)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                if (isReadOnly) return;
                let workspacePriorityUpdate = null;
                if (isEditMode && isPriorityOrderDirty && !isPriorityConfigurationStale && !workspacePrioritiesError) {
                    workspacePriorityUpdate = {
                        revision: workspacePriorities?.revision,
                        orderedWorkspaceIds: priorityItems.map((item) => item.workspaceId),
                    };
                }
                if (workspacePriorityUpdate) {
                    await dataHandler(values, setErrors, setStatus, { workspacePriorityUpdate });
                    return;
                }
                await dataHandler(values, setErrors, setStatus);
            }}
        >
            {({ status }) => (
                <Form className="flex w-full justify-center" autoComplete="off">
                    <CreateFlowDefaults
                        isEditMode={isEditMode}
                        listFlows={listFlows}
                        priorityUpdateFlows={priorityUpdateFlows}
                    />
                    <FormCard isId={!!data?.id} title={t("channelHub.title")} isSending={isSending}>
                        <div className="flex flex-col col-span-3 gap-8">
                            <FormikStatusMessages formikStatus={status} />
                            <SectionForm
                                title={t("channelHub.basicInformation")}
                                id="channel_hub_basic"
                                dataTestId="channel_hub_basic"
                            >
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="email"
                                            label={t("channelHub.email")}
                                            placeholder={t("channelHub.email")}
                                            id="email"
                                            disabled={isEditMode || isReadOnly}
                                            data-testid={formatTestId("channel_hub_form", "email")}
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="name"
                                            label={t("channelHub.name")}
                                            placeholder={t("channelHub.name")}
                                            id="name"
                                            disabled={isReadOnly}
                                            data-testid={formatTestId("channel_hub_form", "name")}
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="country_id"
                                            label={t("channelHub.country_id")}
                                            placeholder={t("channelHub.country_id")}
                                            id="country_id"
                                            disabled={isReadOnly}
                                            data-testid={formatTestId("channel_hub_form", "country_id")}
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <OperatorSelect disabled={isEditMode || isReadOnly} />
                                </InputCard>
                            </SectionForm>

                            <SectionForm
                                title={t("channelHub.connectionDetails")}
                                id="channel_hub_connection"
                                dataTestId="channel_hub_connection"
                            >
                                <InputCard>
                                    <RestFlowSelect
                                        name="rest_flow_id"
                                        label={t("channelHub.rest_flow_id")}
                                        flows={registrationFlows}
                                        disabled={isReadOnly}
                                        isLoading={isLoadingRegistrationFlows}
                                        emptyMessage={t("channelHub.noRegistrationFlows")}
                                        emptyTestId="channel_hub_form_rest_flow_empty"
                                    />
                                </InputCard>
                            </SectionForm>

                            <SectionForm
                                title={t("channelHub.workspaceConfiguration")}
                                id="channel_hub_workspace_configuration"
                                dataTestId="channel_hub_workspace_configuration"
                            >
                                <InputCard>
                                    <RestFlowSelect
                                        name="mail_rule_priority_update_rest_flow_id"
                                        label={t("channelHub.mailRulePriorityUpdateRestFlow")}
                                        flows={priorityUpdateFlows}
                                        disabled={isReadOnly}
                                        isLoading={isLoadingPriorityUpdateFlows}
                                        emptyMessage={t("channelHub.noPriorityUpdateFlows")}
                                        emptyTestId="channel_hub_form_priority_update_rest_flow_empty"
                                        onValueChange={invalidatePriorityConfiguration}
                                    />
                                </InputCard>
                                <InputCard>
                                    <RestFlowSelect
                                        name="mail_rule_list_rest_flow_id"
                                        label={t("channelHub.mailRuleListRestFlow")}
                                        flows={listFlows}
                                        disabled={isReadOnly}
                                        isLoading={isLoadingListFlows}
                                        emptyMessage={t("channelHub.noListFlows")}
                                        emptyTestId="channel_hub_form_list_rest_flow_empty"
                                        onValueChange={invalidatePriorityConfiguration}
                                    />
                                </InputCard>
                            </SectionForm>
                        </div>
                        {isEditMode && (
                            <div className="col-span-2">
                                <WorkspacePriorityList
                                    items={priorityItems}
                                    conflicts={workspacePriorities?.conflicts ?? []}
                                    canReorder={workspacePriorities?.canReorder ?? false}
                                    isLoading={isLoadingWorkspacePriorities}
                                    isApplying={isUpdatingWorkspacePriorities}
                                    error={workspacePrioritiesError}
                                    isReadOnly={isReadOnly}
                                    isConfigured={Boolean(
                                        data?.mail_rule_list_rest_flow_id &&
                                        data?.mail_rule_priority_update_rest_flow_id,
                                    )}
                                    isRegistered={Boolean(data?.channel_hub_connection_id)}
                                    isConfigurationStale={isPriorityConfigurationStale}
                                    onOrderChange={handlePriorityOrderChange}
                                    onRetry={onRetryWorkspacePriorities}
                                />
                            </div>
                        )}
                    </FormCard>
                </Form>
            )}
        </Formik>
    );
};

const restFlowPropertyType = PropTypes.exact({
    id: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
});

const channelHubCreateFormPropertyTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
    isEditMode: PropTypes.bool,
    isReadOnly: PropTypes.bool,
    workspacePriorities: PropTypes.exact({
        items: PropTypes.arrayOf(
            PropTypes.exact({
                workspaceId: PropTypes.string.isRequired,
                description: PropTypes.string.isRequired,
                tag: PropTypes.string,
                priority: PropTypes.number,
            }),
        ),
        revision: PropTypes.string,
        canReorder: PropTypes.bool,
        conflicts: PropTypes.arrayOf(
            PropTypes.exact({
                code: PropTypes.string,
                message: PropTypes.string.isRequired,
                workspaceId: PropTypes.string,
            }),
        ),
    }),
    isLoadingWorkspacePriorities: PropTypes.bool,
    isUpdatingWorkspacePriorities: PropTypes.bool,
    workspacePrioritiesError: PropTypes.any,
    onRetryWorkspacePriorities: PropTypes.func,
};

ChannelHubCreateFormView.propTypes = {
    ...channelHubCreateFormPropertyTypes,
    registrationFlows: PropTypes.arrayOf(restFlowPropertyType),
    listFlows: PropTypes.arrayOf(restFlowPropertyType),
    priorityUpdateFlows: PropTypes.arrayOf(restFlowPropertyType),
    isLoadingRegistrationFlows: PropTypes.bool,
    isLoadingListFlows: PropTypes.bool,
    isLoadingPriorityUpdateFlows: PropTypes.bool,
};

const ChannelHubCreateForm = (props) => {
    const { data: registrationFlows = [], isLoading: isLoadingRegistrationFlows } = useGenericSearchQuery({
        keyQuery: "channel-hub-registration-flows",
        url: "/ws-rest-flows/search",
        table: "ws_rest_flows",
        filter: CHANNEL_HUB_REGISTRATION_FLOW_FILTER,
        order: CHANNEL_HUB_REGISTRATION_FLOW_ORDER,
        select: mapRestFlows,
        enabled: true,
    });

    const { data: listFlows = [], isLoading: isLoadingListFlows } = useGenericSearchQuery({
        keyQuery: "channel-hub-mail-rule-list-flows",
        url: "/ws-rest-flows/search",
        table: "ws_rest_flows",
        filter: buildRestFlowFamilyFilter(CHANNEL_HUB_EXTERNAL_CODES.MAIL_RULES_LIST),
        order: CHANNEL_HUB_REGISTRATION_FLOW_ORDER,
        select: mapRestFlows,
        enabled: true,
    });

    const { data: priorityUpdateFlows = [], isLoading: isLoadingPriorityUpdateFlows } = useGenericSearchQuery({
        keyQuery: "channel-hub-mail-rule-priority-update-flows",
        url: "/ws-rest-flows/search",
        table: "ws_rest_flows",
        filter: buildRestFlowFamilyFilter(CHANNEL_HUB_EXTERNAL_CODES.MAIL_RULE_PRIORITY_UPDATE),
        order: CHANNEL_HUB_REGISTRATION_FLOW_ORDER,
        select: mapRestFlows,
        enabled: true,
    });

    return (
        <ChannelHubCreateFormView
            {...props}
            registrationFlows={registrationFlows}
            listFlows={listFlows}
            priorityUpdateFlows={priorityUpdateFlows}
            isLoadingRegistrationFlows={isLoadingRegistrationFlows}
            isLoadingListFlows={isLoadingListFlows}
            isLoadingPriorityUpdateFlows={isLoadingPriorityUpdateFlows}
        />
    );
};

ChannelHubCreateForm.propTypes = channelHubCreateFormPropertyTypes;

export default ChannelHubCreateForm;
