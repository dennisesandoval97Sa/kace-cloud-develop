import { Formik, Form, FieldArray, getIn, useFormikContext } from "formik";
import PropTypes from "prop-types";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { joiFormikAdapter } from "@kace/utils";
import { formatTestId } from "@/utils/src/helpers";
import { KField, InputFormModal as Input, FormikStatusMessages, Label } from "@kace/ui-shared";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui-shared";
import { DataTableContainer } from "@/components/ui-shared/src/components/table-component/DataTableContainer";
import { BrokerMapperCreateSchema } from "@/schemas/BrokerMapperSchema";
import FormCard from "@/components/core/Cards/FormCard";
import InputCard from "@/components/core/Cards/InputCard";
import SectionForm from "@/components/core/Cards/section-form";
import { INITIAL_FORM } from "../data/constants";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useDebounced from "@/hooks/useDebounced";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import MappersFieldActions from "./MappersFieldActions";

const restFlowOptionPropType = PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    label: PropTypes.string,
    description: PropTypes.string,
    name: PropTypes.string,
});

const SyncRestFlow = ({ restFlowsData, selectedRestFlow, setSelectedRestFlow }) => {
    const { values } = useFormikContext();

    useEffect(() => {
        const raw = values?.rest_flow_id;
        const restFlowId = raw && typeof raw === "object" ? (raw.value ?? raw.id) : raw;
        const selectedId = selectedRestFlow?.[0]?.id ?? selectedRestFlow?.[0]?.value ?? null;
        const selectedLabel = selectedRestFlow?.[0]?.label ?? null;

        if (!restFlowId) {
            if ((selectedRestFlow?.length ?? 0) > 0) setSelectedRestFlow([]);
            return;
        }

        if (restFlowsData.length > 0) {
            const found = restFlowsData.find((item) => String(item.id ?? item.value) === String(restFlowId));
            if (found) {
                const newLabel = found.label ?? found.description ?? found.name ?? String(found.id ?? found.value);
                const newId = found.id ?? found.value;
                const shouldUpdate =
                    String(selectedId) !== String(newId) || String(selectedLabel ?? "") !== String(newLabel ?? "");
                if (shouldUpdate) {
                    setSelectedRestFlow([{ ...found, id: newId, value: newId, label: newLabel }]);
                }
                return;
            }
        }

        if ((selectedRestFlow?.length ?? 0) === 0) {
            setSelectedRestFlow([{ id: restFlowId, value: restFlowId, label: String(restFlowId) }]);
        }
    }, [
        values?.rest_flow_id,
        restFlowsData,
        selectedRestFlow?.[0]?.id,
        selectedRestFlow?.[0]?.label,
        selectedRestFlow?.length,
    ]);

    return null;
};

SyncRestFlow.propTypes = {
    restFlowsData: PropTypes.arrayOf(restFlowOptionPropType).isRequired,
    selectedRestFlow: PropTypes.arrayOf(restFlowOptionPropType).isRequired,
    setSelectedRestFlow: PropTypes.func.isRequired,
};

const createRuleColumns = ({ t, handleEdit, handleRemove }) => [
    {
        id: "actions",
        cell: ({ row }) => (
            <MappersFieldActions
                handleEdit={handleEdit}
                handleRemove={handleRemove}
                rowIndex={row.original?._idx ?? row.index}
            />
        ),
    },
    {
        id: "target_entity",
        header: t("broker.mappers.rules.targetEntity"),
        accessorKey: "target_entity",
    },
    {
        id: "target_field",
        header: t("broker.mappers.rules.targetField"),
        accessorKey: "target_field",
    },
    {
        id: "source_field",
        header: t("broker.mappers.rules.sourceField"),
        accessorKey: "source_field",
    },
    {
        id: "parse_to",
        header: t("broker.mappers.rules.parseTo"),
        accessorKey: "parse_to",
    },
];

const RulesTable = ({
    name = "rules",
    rulesQuery,
    setRulesQuery,
    setEditingRuleIndex,
    setIsNewRule,
    setOriginalRule,
    setIsRuleModalOpen,
}) => {
    const { t } = useTranslation();
    const { values, errors, setFieldValue } = useFormikContext();

    const items = useMemo(
        () =>
            (values?.[name] || [])
                .map((rule, index) => ({
                    ...rule,
                    _idx: index,
                    bgColor: errors?.[name]?.[index] ? "#e0907a" : "",
                }))
                .filter(
                    (rule) =>
                        !rulesQuery?.length ||
                        (rule.target_entity || "").toLowerCase().indexOf(rulesQuery.toLowerCase()) >= 0,
                ),
        [values, name, rulesQuery, errors],
    );

    const handleEdit = (index) => {
        const rule = values?.[name]?.[index];
        setEditingRuleIndex(index);
        setIsNewRule(false);
        setOriginalRule(rule ? { ...rule } : null);
        setIsRuleModalOpen(true);
    };

    const handleRemove = (index) => {
        const updatedRules = [...(values?.[name] || [])];
        updatedRules.splice(index, 1);
        setFieldValue(name, updatedRules);
    };

    const columns = createRuleColumns({ t, handleEdit, handleRemove });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between">
                <Input
                    label={t("broker.mappers.rules.filter")}
                    placeholder={t("broker.mappers.rules.filter")}
                    onChange={(event) => setRulesQuery(event.target.value)}
                    data-testid={formatTestId("mapper_form", "rules_filter")}
                />
                <Button
                    type="button"
                    onClick={() => {
                        const current = values?.[name] || [];
                        setFieldValue(name, [
                            ...current,
                            {
                                id: undefined,
                                target_entity: "",
                                target_field: "",
                                source_field: "",
                                parse_to: null,
                            },
                        ]);
                        setEditingRuleIndex(current.length);
                        setIsNewRule(true);
                        setOriginalRule(null);
                        setIsRuleModalOpen(true);
                    }}
                    data-testid={formatTestId("mapper_form", "rule_add")}
                >
                    {t("broker.mappers.rules.addRule")}
                </Button>
            </div>

            <DataTableContainer
                showUpdateButton={false}
                showFilterGeneric={false}
                showColumnsButton={false}
                columns={columns}
                dataTable={items}
                view={{ url: "", schema: "", key: "", keySchema: "", view: "" }}
                rowActions={{
                    onEdit: (row) => {
                        const index = row?._idx ?? items.findIndex((rule) => rule === row);
                        if (index >= 0) handleEdit(index);
                    },
                    onDelete: (row) => {
                        const index = row?._idx ?? items.findIndex((rule) => rule === row);
                        if (index >= 0) handleRemove(index);
                    },
                }}
                autoResetPageIndex={false}
            />
        </div>
    );
};

RulesTable.propTypes = {
    name: PropTypes.string,
    rulesQuery: PropTypes.string.isRequired,
    setRulesQuery: PropTypes.func.isRequired,
    setEditingRuleIndex: PropTypes.func.isRequired,
    setIsNewRule: PropTypes.func.isRequired,
    setOriginalRule: PropTypes.func.isRequired,
    setIsRuleModalOpen: PropTypes.func.isRequired,
};

const RuleEditModal = ({
    name = "rules",
    isRuleModalOpen,
    setIsRuleModalOpen,
    editingRuleIndex,
    setEditingRuleIndex,
    isNewRule,
    setIsNewRule,
    originalRule,
    setOriginalRule,
}) => {
    const { t } = useTranslation();
    const { values, setFieldTouched, setFieldValue, validateForm } = useFormikContext();

    const closeDialog = () => {
        setIsRuleModalOpen(false);
        setEditingRuleIndex(null);
        setIsNewRule(false);
        setOriginalRule(null);
    };

    const handleCancel = () => {
        const updated = [...(values?.[name] || [])];
        if (isNewRule) {
            updated.splice(editingRuleIndex, 1);
            setFieldValue(name, updated);
        } else if (originalRule && editingRuleIndex !== null) {
            updated[editingRuleIndex] = originalRule;
            setFieldValue(name, updated);
        }
        closeDialog();
    };

    const handleSave = async () => {
        const fieldNames = ["target_entity", "target_field", "source_field"];
        await Promise.all(
            fieldNames.map((fieldName) => setFieldTouched(`${name}[${editingRuleIndex}].${fieldName}`, true, false)),
        );

        const validationErrors = await validateForm();
        if (getIn(validationErrors, `${name}[${editingRuleIndex}]`)) return;

        const current = values?.[name] || [];
        const rule = current[editingRuleIndex] || {};
        const cleaned = {};
        Object.keys(rule).forEach((key) => {
            const value = rule[key];
            if (value !== "") cleaned[key] = value;
        });

        const updated = [...current];
        updated[editingRuleIndex] = cleaned;
        await setFieldValue(name, updated);
        closeDialog();
    };

    if (!isRuleModalOpen) return null;

    return (
        <Dialog
            open={isRuleModalOpen}
            onOpenChange={(open) => {
                if (!open) handleCancel();
            }}
        >
            <DialogContent className="sm:max-w-[768px] max-h-[calc(100vh-2rem)] overflow-auto">
                <DialogHeader>
                    <DialogTitle>{t("broker.mappers.rules.ruleDetails")}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col justify-stretch gap-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <KField>
                            <Input
                                name={`${name}[${editingRuleIndex}].target_entity`}
                                label={`${t("broker.mappers.rules.targetEntity")}\u00a0*`}
                                aria-label={`${t("broker.mappers.rules.targetEntity")} *`}
                            />
                        </KField>
                        <KField>
                            <Input
                                name={`${name}[${editingRuleIndex}].target_field`}
                                label={`${t("broker.mappers.rules.targetField")}\u00a0*`}
                                aria-label={`${t("broker.mappers.rules.targetField")} *`}
                            />
                        </KField>
                        <KField>
                            <Input
                                name={`${name}[${editingRuleIndex}].source_field`}
                                label={`${t("broker.mappers.rules.sourceField")}\u00a0*`}
                                aria-label={`${t("broker.mappers.rules.sourceField")} *`}
                            />
                        </KField>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t("broker.mappers.rules.parseTo")}
                            </label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={values?.[name]?.[editingRuleIndex]?.parse_to || ""}
                                onChange={(event) => {
                                    const value = event.target.value || null;
                                    setFieldValue(`${name}[${editingRuleIndex}].parse_to`, value);
                                }}
                                data-testid={formatTestId("mapper_form", "rule_parse_to")}
                            >
                                <option value="">{t("broker.mappers.rules.selectParseTo")}</option>
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="datetime">Datetime</option>
                            </select>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        onClick={handleCancel}
                        data-testid={formatTestId("mapper_form", "rule_cancel")}
                    >
                        {t("broker.mappers.rules.cancel")}
                    </Button>
                    <Button type="button" onClick={handleSave} data-testid={formatTestId("mapper_form", "rule_save")}>
                        {t("broker.mappers.rules.save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

RuleEditModal.propTypes = {
    name: PropTypes.string,
    isRuleModalOpen: PropTypes.bool.isRequired,
    setIsRuleModalOpen: PropTypes.func.isRequired,
    editingRuleIndex: PropTypes.number,
    setEditingRuleIndex: PropTypes.func.isRequired,
    isNewRule: PropTypes.bool.isRequired,
    setIsNewRule: PropTypes.func.isRequired,
    originalRule: PropTypes.object,
    setOriginalRule: PropTypes.func.isRequired,
};

const MappersCreateForm = ({ dataHandler, data = {}, isSending = false }) => {
    const { t } = useTranslation();
    const [selectedRestFlow, setSelectedRestFlow] = useState([]);
    const [restFlowQuery, setRestFlowQuery] = useState("");
    const [currentRestFlowId, setCurrentRestFlowId] = useState(null);
    const handlerOnRestFlowInputChange = useDebounced((value) => setRestFlowQuery(value), 500);

    const toRestFlowOption = useCallback((item) => {
        if (!item) return null;
        const id = item.id ?? item.value;
        if (id === undefined || id === null || id === "") return null;
        const label = item.description ?? item.name ?? item.label ?? String(id);
        return {
            ...item,
            id,
            value: id,
            label,
        };
    }, []);
    const normalizeMapper = (a) => {
        if (!a) return {};
        const keys = ["id", "name", "queue", "rest_flow_id", "rules"];
        return keys.reduce((acc, key) => {
            const raw = a[key];
            const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
            acc[key] = value ?? (Array.isArray(raw) ? [] : "");
            return acc;
        }, {});
    };

    const initialValues = useMemo(() => {
        if (data && Object.keys(data).length !== 0) return { ...INITIAL_FORM, ...normalizeMapper(data) };
        return { ...INITIAL_FORM };
    }, [data]);

    useEffect(() => {
        const raw = initialValues?.rest_flow_id;
        const id = raw && typeof raw === "object" ? (raw.value ?? raw.id) : raw;
        setCurrentRestFlowId(id !== undefined && id !== null && id !== "" ? String(id) : null);
    }, [initialValues?.rest_flow_id]);
    const [rulesQuery, setRulesQuery] = useState("");
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [editingRuleIndex, setEditingRuleIndex] = useState(null);
    const [isNewRule, setIsNewRule] = useState(false);
    const [originalRule, setOriginalRule] = useState(null);
    const restFlowFilters = [
        {
            field: `${URL_AND_KEYS.restFlows.view}.is_primary`,
            operator: "eq",
            value: "true",
            type: "AND",
        },
    ];

    if (restFlowQuery) {
        restFlowFilters.push({
            field: `${URL_AND_KEYS.restFlows.view}.description`,
            operator: "ilike",
            value: restFlowQuery,
            type: "OR",
        });
    }

    const {
        data: restFlowsDataRaw = [],
        isLoading: isLoadingRestFlows,
        isFetchingNextPage: isFetchingNextPageRestFlows,
        fetchNextPage: fetchNextPageRestFlows,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.restFlows.url}/search`,
        keyQuery: [URL_AND_KEYS.restFlows.key, restFlowQuery],
        filter: restFlowFilters,
        enabled: Boolean(restFlowQuery),
        select: (data) => {
            const allItems = data?.pages ? data.pages.flatMap((p) => p.data || []) : (data?.data ?? []);
            const mapped = (allItems ?? []).map((item) => toRestFlowOption(item)).filter(Boolean);
            return [...new Map(mapped.map((it) => [String(it.id ?? it.value), it])).values()];
        },
        pageSize: 10,
        table: URL_AND_KEYS.restFlows.entity,
    });

    const currentRestFlowFilters = [];
    if (currentRestFlowId) {
        currentRestFlowFilters.push(
            {
                field: "id",
                operator: "eq",
                value: currentRestFlowId,
                type: "AND",
            },
            {
                field: `${URL_AND_KEYS.restFlows.view}.is_primary`,
                operator: "eq",
                value: "true",
                type: "AND",
            },
        );
    }

    const { data: currentRestFlowDataRaw = [], isLoading: isLoadingCurrentRestFlow } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.restFlows.url}/search`,
        keyQuery: [URL_AND_KEYS.restFlows.key, "current", currentRestFlowId],
        table: URL_AND_KEYS.restFlows.entity,
        filter: currentRestFlowFilters,
        enabled: Boolean(currentRestFlowId),
        select: (data) => {
            const allItems = data?.pages ? data.pages.flatMap((p) => p.data || []) : (data?.data ?? []);
            const mapped = (allItems ?? []).map((item) => toRestFlowOption(item)).filter(Boolean);
            return [...new Map(mapped.map((it) => [String(it.id ?? it.value), it])).values()];
        },
        pageSize: 1,
    });

    const restFlowsData = useMemo(() => {
        const combined = [...(currentRestFlowDataRaw ?? []), ...(restFlowsDataRaw ?? [])];
        return [...new Map(combined.map((it) => [String(it.id ?? it.value), it])).values()];
    }, [restFlowsDataRaw, currentRestFlowDataRaw]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={initialValues}
            validationSchema={joiFormikAdapter(BrokerMapperCreateSchema)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                await dataHandler(values, setErrors, setStatus);
            }}
        >
            {({ errors, status, setFieldTouched, setFieldValue, submitCount, touched, values }) => {
                const showRestFlowError = Boolean(errors.rest_flow_id && (touched.rest_flow_id || submitCount > 0));

                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={!!data?.id} title={t("broker.mappers.title")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <FormikStatusMessages formikStatus={status} />
                                <p className="text-sm text-muted-foreground">
                                    {t("broker.mappers.requiredFieldsGuidance")}
                                </p>
                                <SyncRestFlow
                                    restFlowsData={restFlowsData}
                                    selectedRestFlow={selectedRestFlow}
                                    setSelectedRestFlow={setSelectedRestFlow}
                                />
                                <SectionForm
                                    title={t("broker.mappers.basicInformation")}
                                    id="mapper_basic_info"
                                    dataTestId="mapper_basic_info"
                                >
                                    <InputCard>
                                        <KField>
                                            <Input
                                                name="name"
                                                label={`${t("broker.mappers.placeholder.name")} *`}
                                                placeholder={t("broker.mappers.placeholder.name")}
                                                id="name"
                                                data-testid={formatTestId("mapper_form", "name")}
                                            />
                                        </KField>
                                    </InputCard>
                                </SectionForm>

                                <SectionForm
                                    title={t("broker.mappers.mapping")}
                                    id="mapper_mapping"
                                    dataTestId="mapper_mapping"
                                >
                                    <InputCard>
                                        <KField>
                                            <Input
                                                name="queue"
                                                label={t("broker.mappers.placeholder.queue")}
                                                placeholder={t("broker.mappers.placeholder.queue")}
                                                id="queue"
                                                data-testid={formatTestId("mapper_form", "queue")}
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label
                                                htmlFor="rest_flow_id"
                                                className={`text-sm text-right flex justify-end ${
                                                    showRestFlowError ? "text-redCustom font-semibold" : ""
                                                }`}
                                            >
                                                {`${t("broker.mappers.placeholder.rest_flow_id")} *`}
                                            </Label>
                                            <div className="w-full col-span-3">
                                                <MultiSelect
                                                    id="rest_flow_id"
                                                    type="button"
                                                    dataTestid={formatTestId("mapper_form", "rest_flow_id")}
                                                    placeholder={
                                                        selectedRestFlow?.[0]?.label ??
                                                        t("broker.mappers.placeholder.rest_flow_id")
                                                    }
                                                    single={true}
                                                    clearable={true}
                                                    hiddenSelectedAll={true}
                                                    selectedData={selectedRestFlow}
                                                    options={restFlowsData}
                                                    isLoading={isLoadingRestFlows || isLoadingCurrentRestFlow}
                                                    isFetchingNextPage={isFetchingNextPageRestFlows}
                                                    fetchNextPage={fetchNextPageRestFlows}
                                                    onInputChange={handlerOnRestFlowInputChange}
                                                    onClearSelection={async () => {
                                                        await setFieldValue("rest_flow_id", "", true);
                                                        await setFieldTouched("rest_flow_id", true, false);
                                                        setSelectedRestFlow([]);
                                                        setCurrentRestFlowId(null);
                                                    }}
                                                    onSelectOption={(opt) => {
                                                        const rawId =
                                                            opt && typeof opt === "object"
                                                                ? (opt.value ?? opt.id)
                                                                : opt;
                                                        const id =
                                                            rawId !== undefined && rawId !== null && rawId !== ""
                                                                ? String(rawId)
                                                                : rawId;
                                                        setFieldValue("rest_flow_id", id);
                                                        setFieldTouched("rest_flow_id", true, false);
                                                        setCurrentRestFlowId(
                                                            id !== undefined && id !== null && id !== ""
                                                                ? String(id)
                                                                : null,
                                                        );

                                                        if (id !== undefined && id !== null && id !== "") {
                                                            const found = restFlowsData.find(
                                                                (it) => String(it.id ?? it.value) === String(id),
                                                            );
                                                            const optLabel =
                                                                opt && typeof opt === "object"
                                                                    ? (opt.label ?? opt.description ?? opt.name)
                                                                    : null;
                                                            const label =
                                                                found?.label ??
                                                                found?.description ??
                                                                found?.name ??
                                                                optLabel ??
                                                                String(id);
                                                            setSelectedRestFlow([
                                                                {
                                                                    ...(found ?? {}),
                                                                    ...(opt && typeof opt === "object" ? opt : {}),
                                                                    id,
                                                                    value: id,
                                                                    label,
                                                                },
                                                            ]);
                                                        } else {
                                                            setSelectedRestFlow([]);
                                                        }
                                                    }}
                                                />
                                                {showRestFlowError && (
                                                    <Label className="text-redCustom font-semibold">
                                                        {errors.rest_flow_id}
                                                    </Label>
                                                )}
                                            </div>
                                        </div>
                                    </InputCard>
                                </SectionForm>
                                <SectionForm
                                    title={t("broker.mappers.rules.title")}
                                    id="mapper_rules"
                                    dataTestId="mapper_rules"
                                >
                                    <InputCard>
                                        <FieldArray name="rules">
                                            {() => (
                                                <RulesTable
                                                    name="rules"
                                                    rulesQuery={rulesQuery}
                                                    setRulesQuery={setRulesQuery}
                                                    setEditingRuleIndex={setEditingRuleIndex}
                                                    setIsNewRule={setIsNewRule}
                                                    setOriginalRule={setOriginalRule}
                                                    setIsRuleModalOpen={setIsRuleModalOpen}
                                                />
                                            )}
                                        </FieldArray>
                                        <RuleEditModal
                                            name="rules"
                                            isRuleModalOpen={isRuleModalOpen}
                                            setIsRuleModalOpen={setIsRuleModalOpen}
                                            editingRuleIndex={editingRuleIndex}
                                            setEditingRuleIndex={setEditingRuleIndex}
                                            isNewRule={isNewRule}
                                            setIsNewRule={setIsNewRule}
                                            originalRule={originalRule}
                                            setOriginalRule={setOriginalRule}
                                        />
                                    </InputCard>
                                </SectionForm>
                            </div>
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};

MappersCreateForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};

export default MappersCreateForm;
