import { joiFormikAdapter } from "@kace/utils";
import { Form, Formik } from "formik";
import PropTypes from "prop-types";
import FormCard from "../../../components/core/Cards/FormCard";
import { GeneralSetupSchemaForm } from "../../../schemas/GeneralSetupSchemaForm";
import {
    ACTIVE_SESSION_LIMIT_RANGE,
    REPORT_FILTER_DAYS_RANGE,
} from "@kace/core/src/global-config/domain/settings/behaviorNumericRanges.js";
import { useEffect, useState, useMemo } from "react";
import SectionForm from "../../../components/core/Cards/section-form";
import { InputForm as Input, KField, SelectForm } from "@kace/ui-shared";
import { GeneralSetupTabsContainer } from "./GeneralSetupFormComponents/GeneralSetupTabsContainer";
import { INITIAL_VALUES_GLOBAL_SETUP } from "../data/constants";
import {
    blockNumericSignAndDecimalKeys,
    blockNumericSignAndDecimalPaste,
    getGeneralSetupErrorLabel,
    handleCreateObject,
    isReopenWindowUnlimited,
    mergeFormDataWithDefaults,
} from "../helpers";
import { useTranslation } from "react-i18next";
import { CheckBoxContainer } from "./GeneralSetupFormComponents/CheckBoxContainer";
import { CardModulesTab } from "./GeneralSetupFormComponents/CardModulesTab";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { SelectByUrl } from "../../../components/core/SelectByUrl/SelectByUrl";
import { useParams } from "react-router-dom";
import useAuxiliariesOptions from "@/hooks/useAuxiliariesOptions";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { FilesSelect } from "./GeneralSetupFormComponents/FilesSelect";
import WorkQueueSortingRules from "./GeneralSetupFormComponents/WorkQueueSortingRules";
import { SelectSingleSearch } from "@/components/core/SelectContainer/SelectSingleSearch";
import { bodyFilterParams, formatSchema, processSchemaData } from "../helpers/ProccesSelectSingle";
import SelectFromQuery from "@/componentsV2/lib/SelectFromQuery";
import { routes } from "@/routes/routes";

const processResFlowData = (data) => {
    try {
        const allItems = data?.pages ? data.pages.flatMap(({ data }) => data) : (data?.data ?? []);

        const uniqueMap = new Map();

        allItems.forEach((item) => {
            uniqueMap.set(item.id, item);
        });

        return Array.from(uniqueMap.values()).map((item) => ({
            id: item.id,
            label: item.description,
            value: item.id,
        }));
    } catch (error) {
        // Errors are intentionally not logged or thrown to prevent flow interruption
        return [];
    }
};

export const GeneralSetupForm = ({ dataHandler, data = {}, isSending }) => {
    const { t } = useTranslation();
    const { id: selectedId } = useParams();
    const [formValues, setFormValues] = useState(mergeFormDataWithDefaults(data));
    const { auxiliariesRules } = useAuxiliariesOptions(false);
    const [selectedResFlow, setSelectedResFlow] = useState([]);
    const [currentFlowId, setCurrentFlowId] = useState(null);
    const [searchValue, setSearchValue] = useState("");

    const menuOptions = useMemo(() => {
        return routes.flatMap((route) => {
            const parentId = route.to || route.name;
            if (!parentId) return [];

            const parent = { id: parentId, label: route.name, value: parentId };
            if (route.items) {
                return [
                    parent,
                    ...route.items.reduce((acc, item) => {
                        const childId = item.to || item.name;
                        if (childId) {
                            acc.push({
                                id: childId,
                                label: `${route.name} > ${item.name}`,
                                value: childId,
                            });
                        }
                        return acc;
                    }, []),
                ];
            }
            return [parent];
        });
    }, []);

    const {
        data: resFlowData = [],
        isLoading: resFlowsLoading,
        fetchNextPage: fetchNextResFlows,
        isFetchingNextPage: isFetchingNextResFlows,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.restFlows.url}/search`,
        keyQuery: [URL_AND_KEYS.restFlows.key],
        filter: [{ field: "is_primary", operator: "eq", value: 1, type: "AND" }],
        select: processResFlowData,
        pageSize: 10,
    });

    const { data: currentFlowData = [], isLoading: currentFlowLoading } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.restFlows.url}/search`,
        keyQuery: [URL_AND_KEYS.restFlows.key],
        table: URL_AND_KEYS.restFlows.view,
        filter: currentFlowId
            ? [
                  {
                      field: "id",
                      operator: "eq",
                      value: currentFlowId,
                      type: "AND",
                  },
              ]
            : [],
        enabled: Boolean(currentFlowId),
        select: processResFlowData,
        pageSize: 1,
    });

    const caseFieldOptions = useMemo(() => {
        const entry = auxiliariesRules?.find((r) => r.dataOrigin === "aux_cases");
        return (entry?.options ?? []).map((o) => ({
            value: o.value,
            label: o.label ?? o.value,
        }));
    }, [auxiliariesRules]);

    useEffect(() => {
        if (data) {
            setFormValues(mergeFormDataWithDefaults(data));
            const flowId = data.settings?.flow_id || data.flow_id;
            if (flowId && flowId !== currentFlowId) {
                setCurrentFlowId(flowId);
            }
        }
    }, [data, currentFlowId]);

    useEffect(() => {
        if (currentFlowData.length > 0) {
            setSelectedResFlow(currentFlowData);
        }
    }, [currentFlowData]);

    const combinedResFlowData = useMemo(() => {
        const searchResults = resFlowData || [];
        const current = currentFlowData || [];

        const combined = [...current];
        searchResults.forEach((flow) => {
            if (!combined.find((existing) => existing.id === flow.id)) {
                combined.push(flow);
            }
        });

        return combined;
    }, [resFlowData, currentFlowData]);

    const filteredResFlowData = useMemo(() => {
        if (!searchValue) return combinedResFlowData;

        const lower = searchValue.toLowerCase();

        return combinedResFlowData.filter((flow) => flow.label?.toLowerCase().includes(lower));
    }, [combinedResFlowData, searchValue]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(GeneralSetupSchemaForm)}
            validateOnChange={true}
            validateOnBlur={true}
            onSubmit={(values, { setErrors, setStatus }) => {
                const settings = handleCreateObject(values);
                const valuesFormat = {
                    description: values.description,
                    settings,
                    is_active: values.is_active,
                };
                dataHandler(valuesFormat, setErrors, setStatus);
            }}
        >
            {({ values, setFieldValue, errors, touched, status, submitCount }) => {
                const isQueueAssignment = values.type_assignment === "cola_de_trabajo";
                const hasErrors = submitCount > 0 && Object.keys(errors).length > 0;

                const selectedHiddenMenus = menuOptions.filter((opt) => values.hidden_menus?.includes(opt.id));

                const handleHiddenMenuSelect = (itemId) => {
                    const isSelected = values.hidden_menus?.includes(itemId);
                    const newHiddenMenus = isSelected
                        ? values.hidden_menus.filter((id) => id !== itemId)
                        : [...(values.hidden_menus || []), itemId];
                    setFieldValue("hidden_menus", newHiddenMenus);
                };

                const handleHiddenMenuSelectAll = () => {
                    setFieldValue(
                        "hidden_menus",
                        menuOptions.map((opt) => opt.id),
                    );
                };

                const handleHiddenMenuDeselectAll = () => setFieldValue("hidden_menus", []);

                const handleResFlowSelect = (selectedId) => {
                    const alreadySelected = selectedResFlow?.[0]?.id === selectedId;

                    if (alreadySelected) {
                        setSelectedResFlow([]);
                        setFieldValue("flow_id", "");
                    } else {
                        const selectedData = combinedResFlowData.find((item) => item.id === selectedId);

                        setSelectedResFlow(selectedData ? [selectedData] : []);
                        setFieldValue("flow_id", selectedId);
                    }
                    setSearchValue("");
                };

                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard
                            isId={selectedId}
                            isSending={isSending}
                            title={t("app.title.generalSetup")}
                            status={status}
                        >
                            <div className="flex flex-col col-span-5 gap-8">
                                {hasErrors && (
                                    <div
                                        className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
                                        role="alert"
                                    >
                                        <strong className="font-bold">{t("app.alerts.validationFormErrors")}</strong>
                                        <ul className="list-disc ml-5 mt-2">
                                            {Object.entries(errors).map(([key, value]) => {
                                                if (typeof value !== "string") return null;
                                                return (
                                                    <li key={key}>
                                                        {getGeneralSetupErrorLabel(key, t)}: {value}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                                <SectionForm
                                    title={t("generalSetup.form.title.optionsBehavior")}
                                    subTitle={t("generalSetup.form.title.subtitleBehavior")}
                                    id="general_form_title_and_subtitle"
                                    dataTestId="general_form_title_and_subtitle"
                                >
                                    <div className="flex justify-center w-full p-2">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-4">
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.nameConfiguration")}
                                                    description={t("generalSetup.form.title.subtitleNameConfiguration")}
                                                >
                                                    <KField>
                                                        <Input
                                                            id="description"
                                                            name="description"
                                                            label={t("generalSetup.form.labels.name")}
                                                            type="text"
                                                            placeholder={t("generalSetup.form.labels.name")}
                                                            className="flex flex-col items-start justify-start text-start w-full"
                                                        />
                                                    </KField>
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.caseAssignmentProcess")}
                                                    description={t(
                                                        "generalSetup.form.title.subtitleCaseAssignmentProcess",
                                                    )}
                                                >
                                                    <KField>
                                                        <SelectForm
                                                            name="type_assignment"
                                                            label={t("generalSetup.form.labels.assign")}
                                                            className="flex flex-col items-start justify-start text-start w-auto"
                                                            handle={(value) => {
                                                                if (value === "asignacion_equivalente") {
                                                                    setFieldValue(
                                                                        "assignment_active_session_limit",
                                                                        INITIAL_VALUES_GLOBAL_SETUP.assignment_active_session_limit,
                                                                    );
                                                                }
                                                            }}
                                                            options={[
                                                                {
                                                                    value: "asignacion_equivalente",
                                                                    label: t(
                                                                        "generalSetup.form.labels.equivalentAssignment",
                                                                    ),
                                                                },
                                                                {
                                                                    value: "cola_de_trabajo",
                                                                    label: t(
                                                                        "generalSetup.form.labels.worKQueueAssignment",
                                                                    ),
                                                                },
                                                            ]}
                                                        />
                                                    </KField>

                                                    {isQueueAssignment && (
                                                        <>
                                                            <WorkQueueSortingRules
                                                                caseFieldOptions={caseFieldOptions}
                                                            />
                                                            <KField>
                                                                <Input
                                                                    id="max_cases_per_user"
                                                                    name="max_cases_per_user"
                                                                    value={values.max_cases_per_user}
                                                                    label={t(
                                                                        "generalSetup.form.labels.max_cases_per_user",
                                                                    )}
                                                                    type="number"
                                                                    placeholder={t(
                                                                        "generalSetup.form.labels.max_cases_per_user",
                                                                    )}
                                                                    className="flex flex-col items-start justify-start text-start w-full mt-7"
                                                                />
                                                            </KField>
                                                            <CheckBoxContainer
                                                                text={t(
                                                                    "generalSetup.form.labels.activeUsers_filter_bool",
                                                                )}
                                                                value={values.activeUsers_filter_bool}
                                                                setFieldValue={setFieldValue}
                                                                name="activeUsers_filter_bool"
                                                            />
                                                            <CheckBoxContainer
                                                                text={t(
                                                                    "generalSetup.form.labels.activeUsers_filter_integration_bool",
                                                                )}
                                                                value={values.activeUsers_filter_integration_bool}
                                                                setFieldValue={setFieldValue}
                                                                name="activeUsers_filter_integration_bool"
                                                            />
                                                            <KField>
                                                                <Input
                                                                    id="assignment_active_session_limit"
                                                                    name="assignment_active_session_limit"
                                                                    value={values.assignment_active_session_limit}
                                                                    label={t(
                                                                        "generalSetup.form.labels.assignment_active_session_limit",
                                                                    )}
                                                                    type="number"
                                                                    min={ACTIVE_SESSION_LIMIT_RANGE.min}
                                                                    max={ACTIVE_SESSION_LIMIT_RANGE.max}
                                                                    onChange={(e) =>
                                                                        setFieldValue(
                                                                            "assignment_active_session_limit",
                                                                            e.target.value === ""
                                                                                ? 0
                                                                                : Number(e.target.value),
                                                                        )
                                                                    }
                                                                    onKeyDown={blockNumericSignAndDecimalKeys}
                                                                    onPaste={blockNumericSignAndDecimalPaste}
                                                                    placeholder={t(
                                                                        "generalSetup.form.labels.in_minutes",
                                                                    )}
                                                                    touchedValue={submitCount > 0}
                                                                    className="flex flex-col items-start justify-start text-start w-full mt-7"
                                                                />
                                                            </KField>
                                                            <CheckBoxContainer
                                                                text={t(
                                                                    "generalSetup.form.labels.prioritizeLastResponsibleExcludeDefaultAssignee",
                                                                )}
                                                                value={values.assignLastResponsibleIgnoreDefault}
                                                                setFieldValue={setFieldValue}
                                                                name="assignLastResponsibleIgnoreDefault"
                                                            />
                                                        </>
                                                    )}
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.onescript_cache_config")}
                                                    description={t(
                                                        "generalSetup.form.title.subtitle_onescript_cache_config",
                                                    )}
                                                    id="general_onescript_cache_config"
                                                    data-testid="general_onescript_cache_config"
                                                >
                                                    <KField>
                                                        <Input
                                                            id="onescript_cache_ttl_ms"
                                                            name="onescript_cache_ttl_ms"
                                                            value={values.onescript_cache_ttl_ms ?? 0}
                                                            label={t("generalSetup.form.labels.onescript_cache_ttl_ms")}
                                                            type="number"
                                                            min="0"
                                                            placeholder={t(
                                                                "generalSetup.form.labels.onescript_cache_ttl_ms",
                                                            )}
                                                            className="flex flex-col items-start justify-start text-start w-full"
                                                            onChange={(e) =>
                                                                setFieldValue(
                                                                    "onescript_cache_ttl_ms",
                                                                    e.target.value === "" ? 0 : Number(e.target.value),
                                                                )
                                                            }
                                                            onKeyDown={blockNumericSignAndDecimalKeys}
                                                            onPaste={blockNumericSignAndDecimalPaste}
                                                        />
                                                    </KField>
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.users")}
                                                    description={t("generalSetup.form.title.subtitleUsers")}
                                                >
                                                    <KField>
                                                        <Input
                                                            id="inactivity_time"
                                                            name="inactivity_time"
                                                            value={values.inactivity_time}
                                                            label={t("generalSetup.form.labels.inactivity_time")}
                                                            type="number"
                                                            min={1}
                                                            max={480}
                                                            placeholder={t("generalSetup.form.labels.in_minutes")}
                                                            touchedValue={submitCount > 0}
                                                            className="flex flex-col items-start justify-start text-start w-full mt-7"
                                                            onKeyDown={blockNumericSignAndDecimalKeys}
                                                            onPaste={blockNumericSignAndDecimalPaste}
                                                        />
                                                    </KField>
                                                    <KField>
                                                        <Input
                                                            id="warning_logout_time"
                                                            name="warning_logout_time"
                                                            value={values.warning_logout_time}
                                                            label={t("generalSetup.form.labels.warning_logout_time")}
                                                            type="number"
                                                            min={0}
                                                            max={60}
                                                            placeholder={t("generalSetup.form.labels.in_minutes")}
                                                            touchedValue={submitCount > 0}
                                                            className="flex flex-col items-start justify-start text-start w-full mt-7"
                                                            onKeyDown={blockNumericSignAndDecimalKeys}
                                                            onPaste={blockNumericSignAndDecimalPaste}
                                                        />
                                                    </KField>
                                                    <p className="text-sm text-muted-foreground mt-4 mb-6">
                                                        {t("generalSetup.form.labels.warning_logout_time_hint")}
                                                    </p>
                                                    <KField>
                                                        <Input
                                                            id="active_session_limit"
                                                            name="active_session_limit"
                                                            value={values.active_session_limit}
                                                            label={t("generalSetup.form.labels.active_session_limit")}
                                                            type="number"
                                                            min={ACTIVE_SESSION_LIMIT_RANGE.min}
                                                            max={ACTIVE_SESSION_LIMIT_RANGE.max}
                                                            placeholder={t("generalSetup.form.labels.in_minutes")}
                                                            touchedValue={submitCount > 0}
                                                            className="flex flex-col items-start justify-start text-start w-full mt-7"
                                                            onKeyDown={blockNumericSignAndDecimalKeys}
                                                            onPaste={blockNumericSignAndDecimalPaste}
                                                        />
                                                    </KField>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {t("generalSetup.form.labels.active_session_limit_hint", {
                                                            min: ACTIVE_SESSION_LIMIT_RANGE.min,
                                                            max: ACTIVE_SESSION_LIMIT_RANGE.max,
                                                        })}
                                                    </p>
                                                    <KField>
                                                        <Input
                                                            id="group_membership_check_interval"
                                                            name="group_membership_check_interval"
                                                            value={values.group_membership_check_interval}
                                                            label={t(
                                                                "generalSetup.form.labels.group_membership_check_interval",
                                                            )}
                                                            type="number"
                                                            min={0}
                                                            placeholder={t("generalSetup.form.labels.in_minutes")}
                                                            className="flex flex-col items-start justify-start text-start w-full mt-7"
                                                            onKeyDown={blockNumericSignAndDecimalKeys}
                                                            onPaste={blockNumericSignAndDecimalPaste}
                                                        />
                                                    </KField>

                                                    <KField>
                                                        <SelectSingleSearch
                                                            name="users_schema_id"
                                                            title={t("generalSetup.form.labels.usersSchema")}
                                                            value={values.users_schema_id}
                                                            setFieldValue={setFieldValue}
                                                            error={errors.users_schema_id}
                                                            touched={touched.users_schema_id}
                                                            contentText={t("generalSetup.form.labels.selectASchema")}
                                                            placeholderText={t(
                                                                "generalSetup.form.labels.searchForSchema",
                                                            )}
                                                            url={URL_AND_KEYS.schemas.url}
                                                            keyQuery={URL_AND_KEYS.schemas.key}
                                                            processData={processSchemaData}
                                                            bodyFilter={bodyFilterParams}
                                                            formatData={formatSchema}
                                                        />
                                                    </KField>
                                                    <KField>
                                                        <SelectFromQuery
                                                            name="oneScript_users"
                                                            value={values.oneScript_users ?? ""}
                                                            setFieldValue={setFieldValue}
                                                            errorData={errors.oneScript_users}
                                                            wasTouched={!!touched.oneScript_users}
                                                            url="/one_script/search"
                                                            labelField="name"
                                                            queryKey={["oneScript", "users"]}
                                                            placeholder={t("app.forms.options")}
                                                            label={t("generalSetup.form.labels.oneScript")}
                                                        />
                                                    </KField>
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.reports")}
                                                    description={t("generalSetup.form.title.subtitleReports")}
                                                >
                                                    <KField>
                                                        <Input
                                                            id="report_filter_days"
                                                            name="report_filter_days"
                                                            value={values.report_filter_days ?? 1}
                                                            label={t("generalSetup.form.labels.report_filter_days")}
                                                            type="number"
                                                            min={REPORT_FILTER_DAYS_RANGE.min}
                                                            max={REPORT_FILTER_DAYS_RANGE.max}
                                                            placeholder="1"
                                                            className="flex flex-col items-start justify-start text-start w-full"
                                                            onKeyDown={blockNumericSignAndDecimalKeys}
                                                            onPaste={blockNumericSignAndDecimalPaste}
                                                        />
                                                    </KField>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {t("generalSetup.form.labels.report_filter_days_hint", {
                                                            min: REPORT_FILTER_DAYS_RANGE.min,
                                                            max: REPORT_FILTER_DAYS_RANGE.max,
                                                        })}
                                                    </p>
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.groups")}
                                                    description={t("generalSetup.form.title.subtitleGroups")}
                                                >
                                                    <KField>
                                                        <SelectSingleSearch
                                                            name="groups_schema_id"
                                                            title={t("generalSetup.form.labels.groupsSchema")}
                                                            value={values.groups_schema_id}
                                                            setFieldValue={setFieldValue}
                                                            error={errors.groups_schema_id}
                                                            touched={touched.groups_schema_id}
                                                            contentText={t("generalSetup.form.labels.selectASchema")}
                                                            placeholderText={t(
                                                                "generalSetup.form.labels.searchForSchema",
                                                            )}
                                                            url={URL_AND_KEYS.schemas.url}
                                                            keyQuery={URL_AND_KEYS.schemas.key}
                                                            processData={processSchemaData}
                                                            bodyFilter={bodyFilterParams}
                                                            formatData={formatSchema}
                                                        />
                                                    </KField>
                                                    <KField>
                                                        <SelectFromQuery
                                                            name="oneScript_groups"
                                                            value={values.oneScript_groups ?? ""}
                                                            setFieldValue={setFieldValue}
                                                            errorData={errors.oneScript_groups}
                                                            wasTouched={!!touched.oneScript_groups}
                                                            url="/one_script/search"
                                                            labelField="name"
                                                            queryKey={["oneScript", "groups"]}
                                                            placeholder={t("app.forms.options")}
                                                            label={t("generalSetup.form.labels.oneScript")}
                                                        />
                                                    </KField>
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.hiddenMenus")}
                                                    description={t("generalSetup.form.title.subtitleHiddenMenus")}
                                                >
                                                    <MultiSelect
                                                        options={menuOptions}
                                                        selectedData={selectedHiddenMenus}
                                                        dataTestid="hidden_menus_select"
                                                        onSelectOption={handleHiddenMenuSelect}
                                                        onSelectedAll={handleHiddenMenuSelectAll}
                                                        showDeselectAll
                                                        onDeselectAll={handleHiddenMenuDeselectAll}
                                                        type="input"
                                                        placeholder={t("forms.search")}
                                                    />
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.cases")}
                                                    description={t("generalSetup.form.title.subtitleBehaviorCases")}
                                                >
                                                    <CheckBoxContainer
                                                        text={t(
                                                            "generalSetup.form.labels.due_date_for_ans_calculation",
                                                        )}
                                                        value={values.due_date_for_ans_calculation}
                                                        setFieldValue={setFieldValue}
                                                        name="due_date_for_ans_calculation"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.fieldDescription")}
                                                        value={values.allow_description_empty}
                                                        setFieldValue={setFieldValue}
                                                        name="allow_description_empty"
                                                        data-testid="checkbox_allow_description_empty"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.requireStateChange")}
                                                        value={values.case_require_state_change}
                                                        setFieldValue={setFieldValue}
                                                        name="case_require_state_change"
                                                        data-testid="checkbox_require_state_change"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.lockCaseDescriptionEdit")}
                                                        value={values.lock_case_description_edit}
                                                        setFieldValue={setFieldValue}
                                                        name="lock_case_description_edit"
                                                        data-testid="checkbox_lock_case_description_edit"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.allowCaseReclassification")}
                                                        value={values.allow_case_reclassification}
                                                        setFieldValue={setFieldValue}
                                                        name="allow_case_reclassification"
                                                        data-testid="checkbox_allow_case_reclassification"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.checkCreatingSubcases")}
                                                        value={values.case_enable_subcases}
                                                        setFieldValue={setFieldValue}
                                                        name="case_enable_subcases"
                                                        data-testid="checkbox_case_enable_subcases"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.agent_filter_subcases_only")}
                                                        value={values.agent_filter_subcases_only}
                                                        setFieldValue={setFieldValue}
                                                        name="agent_filter_subcases_only"
                                                        data-testid="checkbox_agent_filter_subcases_only"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.close_tab_on_case_created")}
                                                        value={values.close_tab_on_case_created}
                                                        setFieldValue={setFieldValue}
                                                        name="close_tab_on_case_created"
                                                        data-testid="checkbox_close_tab_on_case_created"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t(
                                                            "generalSetup.form.labels.return_to_board_on_case_saved",
                                                        )}
                                                        value={values.return_to_board_on_case_saved}
                                                        setFieldValue={setFieldValue}
                                                        name="return_to_board_on_case_saved"
                                                        data-testid="checkbox_return_to_board_on_case_saved"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.checkEndToOpenSubcases")}
                                                        value={values.allow_close_case_without_subcases}
                                                        setFieldValue={setFieldValue}
                                                        name="allow_close_case_without_subcases"
                                                        data-testid="checkbox_restrict_close_with_subcases"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.allowNewOneScriptForms")}
                                                        value={values.allow_new_one_script_forms}
                                                        setFieldValue={setFieldValue}
                                                        name="allow_new_one_script_forms"
                                                        data-testid="allow_new_one_script_forms"
                                                    />
                                                    {values.allow_new_one_script_forms && (
                                                        <div className="mt-4">
                                                            <KField
                                                                className="px-2"
                                                                id="cases_one_script_base_form"
                                                                data-testid="cases_one_script_base_form"
                                                            >
                                                                <SelectFromQuery
                                                                    name="cases_one_script_base_form"
                                                                    value={values.cases_one_script_base_form ?? ""}
                                                                    setFieldValue={setFieldValue}
                                                                    errorData={errors.cases_one_script_base_form}
                                                                    wasTouched={!!errors.cases_one_script_base_form}
                                                                    url="/one_script/search"
                                                                    labelField="name"
                                                                    queryKey={["oneScript", "casesBaseForm"]}
                                                                    placeholder={t("app.forms.options")}
                                                                    label={t(
                                                                        "generalSetup.form.labels.casesOneScriptBaseForm",
                                                                    )}
                                                                />
                                                            </KField>
                                                        </div>
                                                    )}
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.semaphore_by_state_ans")}
                                                        value={values.semaphore_by_state_ans}
                                                        setFieldValue={setFieldValue}
                                                        name="semaphore_by_state_ans"
                                                        data-testid="checkbox_semaphore_by_state_ans"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.case_stale_check")}
                                                        value={values.case_stale_check === true}
                                                        setFieldValue={setFieldValue}
                                                        name="case_stale_check"
                                                        data-testid="checkbox_case_stale_check"
                                                    />
                                                    {values.case_stale_check == null &&
                                                    Boolean(values.transition_stale_check) !==
                                                        Boolean(values.responsable_stale_check) ? (
                                                        <p
                                                            className="text-sm text-muted-foreground mt-1 mb-2"
                                                            data-testid="case_stale_check_legacy_widen"
                                                        >
                                                            {t(
                                                                "generalSetup.form.labels.case_stale_check_legacy_widen",
                                                            )}
                                                        </p>
                                                    ) : null}
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.advanced_cases_search")}
                                                        value={values.advanced_cases_search}
                                                        setFieldValue={setFieldValue}
                                                        name="advanced_cases_search"
                                                        data-testid="checkbox_advanced_cases_search"
                                                    />
                                                    {values.advanced_cases_search && (
                                                        <div className="mt-4">
                                                            <KField>
                                                                <SelectFromQuery
                                                                    name="advanced_cases_search_one_script_form"
                                                                    value={
                                                                        values.advanced_cases_search_one_script_form ??
                                                                        ""
                                                                    }
                                                                    setFieldValue={setFieldValue}
                                                                    errorData={
                                                                        errors.advanced_cases_search_one_script_form
                                                                    }
                                                                    wasTouched={
                                                                        !!touched.advanced_cases_search_one_script_form
                                                                    }
                                                                    url="/one_script/search"
                                                                    labelField="name"
                                                                    queryKey={["oneScript", "advancedSearch"]}
                                                                    placeholder={t("app.forms.options")}
                                                                    label={t(
                                                                        "generalSetup.form.labels.advanced_cases_search_one_script_form",
                                                                    )}
                                                                />
                                                            </KField>
                                                        </div>
                                                    )}
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.reassignFilterActiveUsers")}
                                                        value={values.reassignFilterActiveUsers}
                                                        setFieldValue={setFieldValue}
                                                        name="reassignFilterActiveUsers"
                                                    />
                                                    {values.reassignFilterActiveUsers && (
                                                        <div className="pl-8 flex flex-col gap-2 mt-4">
                                                            <CheckBoxContainer
                                                                text={t(
                                                                    "generalSetup.form.labels.reassignIncludeDefaultAssignees",
                                                                )}
                                                                value={values.reassignIncludeDefaultAssignees}
                                                                setFieldValue={setFieldValue}
                                                                name="reassignIncludeDefaultAssignees"
                                                            />
                                                        </div>
                                                    )}
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.add_folio_to_external_code")}
                                                        value={values.add_folio_to_external_code}
                                                        setFieldValue={setFieldValue}
                                                        name="add_folio_to_external_code"
                                                        data-testid="checkbox_add_folio_to_external_code"
                                                    />
                                                    {values.add_folio_to_external_code && (
                                                        <KField>
                                                            <Input
                                                                id="folio_length"
                                                                name="folio_length"
                                                                value={values.folio_length}
                                                                min={1}
                                                                max={100}
                                                                label={t("generalSetup.form.labels.folio_length")}
                                                                type="number"
                                                                placeholder={t("generalSetup.form.labels.folio_length")}
                                                                className="flex flex-col items-start justify-start text-start w-full mt-7"
                                                            />
                                                        </KField>
                                                    )}
                                                    <KField>
                                                        <SelectForm
                                                            name="ans_display_mode"
                                                            label={t("generalSetup.form.labels.ans_display_mode")}
                                                            className="flex flex-col items-start justify-start text-start w-auto"
                                                            options={[
                                                                {
                                                                    value: "row",
                                                                    label: t(
                                                                        "generalSetup.form.labels.ans_display_mode_row",
                                                                    ),
                                                                },
                                                                {
                                                                    value: "circle",
                                                                    label: t(
                                                                        "generalSetup.form.labels.ans_display_mode_circle",
                                                                    ),
                                                                },
                                                            ]}
                                                        />
                                                    </KField>
                                                    <KField>
                                                        <Input
                                                            id="reopen_cases_only_last_days"
                                                            name="reopen_cases_only_last_days"
                                                            value={values.reopen_cases_only_last_days}
                                                            min={0}
                                                            label={t(
                                                                "generalSetup.form.labels.reopen_cases_only_last_days",
                                                            )}
                                                            type="number"
                                                            placeholder={t(
                                                                "generalSetup.form.labels.reopen_cases_only_last_days",
                                                            )}
                                                            className="flex flex-col items-start justify-start text-start w-full mt-7"
                                                            data-testid="reopen_cases_only_last_days"
                                                        />
                                                    </KField>
                                                    <p className="text-sm text-muted-foreground mt-4 mb-6">
                                                        {t("generalSetup.form.labels.reopen_cases_only_last_days_hint")}
                                                    </p>
                                                    {isReopenWindowUnlimited(values.reopen_cases_only_last_days) ? (
                                                        <p
                                                            className="text-sm text-muted-foreground mb-6"
                                                            data-testid="reopen_cases_only_last_days_zero"
                                                        >
                                                            {t(
                                                                "generalSetup.form.labels.reopen_cases_only_last_days_zero",
                                                            )}
                                                        </p>
                                                    ) : null}
                                                </CardModulesTab>
                                            </div>
                                            <div className="flex flex-col gap-4">
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.general")}
                                                    description={t("generalSetup.form.title.subtitleGeneral")}
                                                >
                                                    <SelectByUrl
                                                        name="account_to_send_notifications"
                                                        url={"mail-accounts"}
                                                        value={values.account_to_send_notifications}
                                                        keyQuery="mailAccountsToNotifications"
                                                        setFieldValue={setFieldValue}
                                                        itemLabel="description"
                                                        label={t(
                                                            "generalSetup.form.labels.account_to_send_notifications",
                                                        )}
                                                        error={errors.account_to_send_notifications}
                                                        touched={touched.account_to_send_notifications}
                                                    />
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.geolocation")}
                                                    description={t("generalSetup.form.title.subtitleGeolocation")}
                                                >
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.geolocation_login_bool")}
                                                        value={values.geolocation_login_bool}
                                                        setFieldValue={setFieldValue}
                                                        name="geolocation_login_bool"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t(
                                                            "generalSetup.form.labels.geolocation_client_search_bool",
                                                        )}
                                                        value={values.geolocation_client_search_bool}
                                                        setFieldValue={setFieldValue}
                                                        name="geolocation_client_search_bool"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t(
                                                            "generalSetup.form.labels.geolocation_case_creation_bool",
                                                        )}
                                                        value={values.geolocation_case_creation_bool}
                                                        setFieldValue={setFieldValue}
                                                        name="geolocation_case_creation_bool"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t(
                                                            "generalSetup.form.labels.geolocation_client_creation_bool",
                                                        )}
                                                        value={values.geolocation_client_creation_bool}
                                                        setFieldValue={setFieldValue}
                                                        name="geolocation_client_creation_bool"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t(
                                                            "generalSetup.form.labels.geolocation_client_update_bool",
                                                        )}
                                                        value={values.geolocation_client_update_bool}
                                                        setFieldValue={setFieldValue}
                                                        name="geolocation_client_update_bool"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t(
                                                            "generalSetup.form.labels.geolocation_case_update_bool",
                                                        )}
                                                        value={values.geolocation_case_update_bool}
                                                        setFieldValue={setFieldValue}
                                                        name="geolocation_case_update_bool"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.geolocation_logout_bool")}
                                                        value={values.geolocation_logout_bool}
                                                        setFieldValue={setFieldValue}
                                                        name="geolocation_logout_bool"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t(
                                                            "generalSetup.form.labels.geolocation_current_location_bool",
                                                        )}
                                                        value={values.geolocation_current_location_bool}
                                                        setFieldValue={setFieldValue}
                                                        name="geolocation_current_location_bool"
                                                    />
                                                    <KField>
                                                        <Input
                                                            id="max_map_markers"
                                                            name="max_map_markers"
                                                            value={values.max_map_markers}
                                                            label={t("generalSetup.form.labels.max_map_markers")}
                                                            type="number"
                                                            placeholder={t("generalSetup.form.labels.max_map_markers")}
                                                            className="flex flex-col items-start justify-start text-start w-full mt-7"
                                                        />
                                                    </KField>
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.executed_restflow_search_client")}
                                                    description={t(
                                                        "generalSetup.form.title.subtitle_executed_restflow_search_client",
                                                    )}
                                                >
                                                    <CheckBoxContainer
                                                        text={t(
                                                            "generalSetup.form.labels.enable_resflow_client_search",
                                                        )}
                                                        value={values.execute_ws_restflow}
                                                        setFieldValue={setFieldValue}
                                                        name="execute_ws_restflow"
                                                    />
                                                    {values.execute_ws_restflow && (
                                                        <KField>
                                                            <div className="flex flex-col gap-2">
                                                                <label className="text-sm font-medium">
                                                                    {t(
                                                                        "generalSetup.form.labels.resflow_for_client_search",
                                                                    )}
                                                                </label>
                                                                <MultiSelect
                                                                    type="input"
                                                                    selectedData={selectedResFlow}
                                                                    options={filteredResFlowData}
                                                                    isLoading={resFlowsLoading || currentFlowLoading}
                                                                    onSelectOption={handleResFlowSelect}
                                                                    isFetchingNextPage={isFetchingNextResFlows}
                                                                    fetchNextPage={fetchNextResFlows}
                                                                    onInputChange={(value) => setSearchValue(value)}
                                                                    placeholder={
                                                                        resFlowsLoading || currentFlowLoading
                                                                            ? t("genericTexts.loading")
                                                                            : t(
                                                                                  "actions.form.querybuilder.searchPlaceholder",
                                                                              )
                                                                    }
                                                                    hiddenSelectedAll
                                                                    single
                                                                />
                                                            </div>
                                                        </KField>
                                                    )}
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("app.forms.filesExtension")}
                                                    description={t("app.forms.filesExtensionDescription")}
                                                >
                                                    <FilesSelect />
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("generalSetup.form.title.refreshTabs")}
                                                    description={t("generalSetup.form.title.subtitleRefreshTabs")}
                                                >
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.refresh_tab_case")}
                                                        value={values.refresh_tab_case}
                                                        setFieldValue={setFieldValue}
                                                        name="refresh_tab_case"
                                                        data-testid="checkbox_refresh_tab_case"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.refresh_tab_customer")}
                                                        value={values.refresh_tab_customer}
                                                        setFieldValue={setFieldValue}
                                                        name="refresh_tab_customer"
                                                        data-testid="checkbox_refresh_tab_customer"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.refresh_tab_transitions")}
                                                        value={values.refresh_tab_transitions}
                                                        setFieldValue={setFieldValue}
                                                        name="refresh_tab_transitions"
                                                        data-testid="checkbox_refresh_tab_transitions"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.refresh_tab_subcases")}
                                                        value={values.refresh_tab_subcases}
                                                        setFieldValue={setFieldValue}
                                                        name="refresh_tab_subcases"
                                                        data-testid="checkbox_refresh_tab_subcases"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.refresh_tab_comments")}
                                                        value={values.refresh_tab_comments}
                                                        setFieldValue={setFieldValue}
                                                        name="refresh_tab_comments"
                                                        data-testid="checkbox_refresh_tab_comments"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.refresh_tab_agenda")}
                                                        value={values.refresh_tab_agenda}
                                                        setFieldValue={setFieldValue}
                                                        name="refresh_tab_agenda"
                                                        data-testid="checkbox_refresh_tab_agenda"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.refresh_tab_logs")}
                                                        value={values.refresh_tab_logs}
                                                        setFieldValue={setFieldValue}
                                                        name="refresh_tab_logs"
                                                        data-testid="checkbox_refresh_tab_logs"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.refresh_tab_interactions")}
                                                        value={values.refresh_tab_interactions}
                                                        setFieldValue={setFieldValue}
                                                        name="refresh_tab_interactions"
                                                        data-testid="checkbox_refresh_tab_interactions"
                                                    />
                                                    <CheckBoxContainer
                                                        text={t("generalSetup.form.labels.refresh_tab_notifications")}
                                                        value={values.refresh_tab_notifications}
                                                        setFieldValue={setFieldValue}
                                                        name="refresh_tab_notifications"
                                                        data-testid="checkbox_refresh_tab_notifications"
                                                    />
                                                </CardModulesTab>
                                                <CardModulesTab
                                                    title={t("navbar.interactions")}
                                                    description={t("interactions.generalSetup.subtitle")}
                                                >
                                                    <CheckBoxContainer
                                                        text={t("interactions.generalSetup.allowInteraction")}
                                                        value={values.enable_view_interaction}
                                                        setFieldValue={setFieldValue}
                                                        name="enable_view_interaction"
                                                    />
                                                </CardModulesTab>
                                            </div>
                                        </div>
                                    </div>
                                </SectionForm>
                            </div>
                            <div className="flex flex-col col-span-5 gap-8">
                                <SectionForm
                                    title={t("generalSetup.form.title.optionsLayout")}
                                    id="general_form_title_options_layout"
                                    data-testid="general_form_title_options_layout"
                                >
                                    <GeneralSetupTabsContainer
                                        values={values}
                                        setFieldValue={setFieldValue}
                                        errors={errors}
                                        touched={touched}
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

GeneralSetupForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};
