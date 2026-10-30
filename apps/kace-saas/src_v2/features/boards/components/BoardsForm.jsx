import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Form, Formik, useFormikContext } from "formik";
import FormCard from "@kace_v2/shared/ui/molecules/FormCard";
import InputField from "@kace_v2/shared/ui/molecules/InputField";
import SwitchField from "@kace_v2/shared/ui/molecules/SwitchField";
import BoardsRelations from "@kace_v2/features/boards/components/BoardsRelations";
import BoardsParameters from "@kace_v2/features/boards/components/BoardsParameters";
import BoardsHavings from "@kace_v2/features/boards/components/BoardsHavings";
import BoardsOptions from "@kace_v2/features/boards/components/BoardsOptions";
import useOneScriptOptions from "@kace_v2/features/boards/hooks/useOneScriptOptions.hook";
import MultiSelectGroups from "@kace_v2/shared/ui/organisms/MultiSelectGroups";
import MultiSelectUsers from "@kace_v2/shared/ui/organisms/MultiSelectUsers";
import BoardsInitialFilter from "@kace_v2/features/boards/components/BoardsInitialFilter";
import useBoardsEntities from "@kace_v2/features/boards/hooks/useBoardsEntities.hook";
import SelectIconField from "@kace_v2/shared/ui/molecules/SelectIconField";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import {
    BOARDS_DETAILS,
    QUICK_ANS_FILTER_DEFAULT_COLORS,
    QUICK_ANS_FILTER_DEFAULT_LABELS,
} from "@kace_v2/features/boards/constants/boards.constants";
import { getAnsColumnOptions } from "@kace_v2/features/boards/utils/ansColumnOptions.util";
import useAns from "@kace_v2/features/boards/hooks/useAns.hook";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";
import { joiFormikAdapter } from "@kace/utils";
import { validateBoardsDetails } from "@kace_v2/features/boards/schemas/boards.schema";
import FormContent from "@kace_v2/shared/ui/molecules/FormContent";
import Loader from "@kace_v2/shared/ui/molecules/Loader";
import BoardsSorting from "@kace_v2/features/boards/components/BoardsSorting";
import { useTranslation } from "react-i18next";
import { normalizeBoardsData } from "@kace_v2/features/boards/utils/normalizeBoardsData.util";
import { isAggregateFunction } from "@kace_v2/features/boards/utils/boardFunctionsHelper.util";
import { getMissingBulkColumns, isCasesLikeEntity } from "@kace_v2/features/boards/utils/casesEntity.util";
import useSchemaFields from "@/hooks/useSchemaFields";
import { toast } from "sonner";

const BulkActionsStateSync = ({ isCasesEntity, disableByGrouping, t }) => {
    const { values, setFieldValue } = useFormikContext();
    const hasShownDisableToastRef = useRef(false);
    const valuesRef = useRef(values);
    valuesRef.current = values;

    useEffect(() => {
        const v = valuesRef.current;
        if (!isCasesEntity) {
            if (v?.can_admin_bulk_actions !== false) {
                setFieldValue("can_admin_bulk_actions", false);
            }
            if (v?.can_agent_bulk_actions !== false) {
                setFieldValue("can_agent_bulk_actions", false);
            }
            hasShownDisableToastRef.current = false;
            return;
        }

        if (!disableByGrouping) {
            hasShownDisableToastRef.current = false;
            return;
        }

        const hasEnabledBulkActions = v?.can_admin_bulk_actions === true || v?.can_agent_bulk_actions === true;

        if (!hasEnabledBulkActions) {
            return;
        }

        if (!hasShownDisableToastRef.current) {
            toast.info(t("boards.form.bulkActions.disabledByGroupingToast"));
            hasShownDisableToastRef.current = true;
        }

        setFieldValue("can_admin_bulk_actions", false);
        setFieldValue("can_agent_bulk_actions", false);
    }, [disableByGrouping, isCasesEntity, setFieldValue, t]);

    return null;
};

BulkActionsStateSync.propTypes = {
    isCasesEntity: PropTypes.bool,
    disableByGrouping: PropTypes.bool,
    t: PropTypes.func,
};

const DeleteActionsStateSync = ({ isAuxEntity, disableByGrouping, t }) => {
    const { values, setFieldValue } = useFormikContext();
    const hasShownDisableToastRef = useRef(false);
    const valuesRef = useRef(values);
    valuesRef.current = values;

    useEffect(() => {
        const v = valuesRef.current;
        if (!isAuxEntity) {
            if (v?.can_admin_delete_record !== false) {
                setFieldValue("can_admin_delete_record", false);
            }
            if (v?.can_agent_delete_record !== false) {
                setFieldValue("can_agent_delete_record", false);
            }
            hasShownDisableToastRef.current = false;
            return;
        }

        if (!disableByGrouping) {
            hasShownDisableToastRef.current = false;
            return;
        }

        const hasEnabled = v?.can_admin_delete_record === true || v?.can_agent_delete_record === true;

        if (!hasEnabled) {
            return;
        }

        if (!hasShownDisableToastRef.current) {
            toast.info(t("boards.form.deleteRecord.disabledByGroupingToast"));
            hasShownDisableToastRef.current = true;
        }

        setFieldValue("can_admin_delete_record", false);
        setFieldValue("can_agent_delete_record", false);
    }, [disableByGrouping, isAuxEntity, setFieldValue, t]);

    return null;
};

DeleteActionsStateSync.propTypes = {
    isAuxEntity: PropTypes.bool,
    disableByGrouping: PropTypes.bool,
    t: PropTypes.func,
};

const QuickAnsDefaultColorsPreview = ({ defaultLabelByPosition }) => {
    const { t } = useTranslation();
    const { data: ansItems } = useAns(true);
    const firstAns = ansItems?.[0];
    const colors = {
        1: firstAns?.color_ans_inicial ?? QUICK_ANS_FILTER_DEFAULT_COLORS[1],
        2: firstAns?.color_ans_intermedio ?? QUICK_ANS_FILTER_DEFAULT_COLORS[2],
        3: firstAns?.color_ans_final ?? QUICK_ANS_FILTER_DEFAULT_COLORS[3],
    };
    return (
        <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
                <span
                    key={n}
                    className="inline-block w-5 h-5 rounded-full border border-input"
                    style={{ backgroundColor: colors[n] }}
                    title={`${defaultLabelByPosition(n)}: ${colors[n]}`}
                />
            ))}
            <span className="text-xs text-muted-foreground self-center">
                {t("boards.form.quickAnsFilter.labels.defaultColorsHint")}
            </span>
        </div>
    );
};

QuickAnsDefaultColorsPreview.propTypes = {
    defaultLabelByPosition: PropTypes.func.isRequired,
};

const QuickAnsFilterStateSync = () => {
    const { values, setFieldValue } = useFormikContext();

    useEffect(() => {
        const ansAliases = getAnsColumnOptions(values?.columns).map((option) => option.value);
        const qaf = values?.quick_ans_filter;
        const enabled = qaf?.enabled === true;
        const currentAlias = qaf?.ans_column_alias || "";

        if (ansAliases.length === 0) {
            const isDirty =
                enabled ||
                currentAlias !== "" ||
                qaf?.labels?.[1] ||
                qaf?.labels?.[2] ||
                qaf?.labels?.[3] ||
                qaf?.use_default_colors !== true;

            if (isDirty) {
                setFieldValue("quick_ans_filter", {
                    ...BOARDS_DETAILS.INITIAL_VALUES.quick_ans_filter,
                    labels: { ...BOARDS_DETAILS.INITIAL_VALUES.quick_ans_filter.labels },
                    colors: { ...BOARDS_DETAILS.INITIAL_VALUES.quick_ans_filter.colors },
                });
            }
            return;
        }

        if (!enabled) return;

        if (ansAliases.length === 1) {
            const onlyAlias = ansAliases[0];
            if (currentAlias !== onlyAlias) {
                setFieldValue("quick_ans_filter.ans_column_alias", onlyAlias);
            }
            return;
        }

        if (currentAlias && !ansAliases.includes(currentAlias)) {
            setFieldValue("quick_ans_filter.ans_column_alias", "");
        }
    }, [values?.columns, values?.quick_ans_filter?.enabled, setFieldValue]);

    return null;
};

const BoardsForm = ({
    title,
    labelButton,
    initialData = BOARDS_DETAILS.INITIAL_VALUES,
    isPending,
    handlerSubmit = () => {},
    onBack,
}) => {
    const oneScriptEnsureIds = useMemo(
        () => [initialData?.onescript_form_id, initialData?.filter_onescript_id].filter(Boolean),
        [initialData?.onescript_form_id, initialData?.filter_onescript_id],
    );
    const {
        data: oneScriptOptions,
        isLoading: isLoadingOneScriptOptions,
        onSearch: onSearchOneScript,
        fetchNextPage: fetchNextPageOneScript,
        hasNextPage: hasNextPageOneScript,
        isFetchingNextPage: isFetchingNextPageOneScript,
    } = useOneScriptOptions(oneScriptEnsureIds);
    const { data: entitiesOptions, isLoading: isLoadingEntitiesOptions } = useBoardsEntities();
    const { getSchemaField } = useSchemaFields();
    const { t } = useTranslation();
    const [clearRows, setClearRows] = useState(false);

    /*
     * A cases-like view only supports bulk actions when it exposes the required columns.
     * The real `cases` table always does, so it is never gated by column presence.
     */
    const getMissingBulkColumnsForEntity = (entity) => {
        if (!isCasesLikeEntity(entity) || entity === "cases") return [];
        return getMissingBulkColumns(getSchemaField(entity));
    };
    const supportsBulkActions = (entity) =>
        isCasesLikeEntity(entity) && getMissingBulkColumnsForEntity(entity).length === 0;

    const normalizedInitialData = normalizeBoardsData(initialData);

    if (isLoadingOneScriptOptions || isLoadingEntitiesOptions) return <Loader />;

    return (
        <Formik
            enableReinitialize={true}
            initialValues={normalizedInitialData}
            validationSchema={joiFormikAdapter(validateBoardsDetails)}
            validate={(values) => {
                const errors = {};
                if (values.havings && Array.isArray(values.havings) && values.havings.length > 0) {
                    const hasGroupBy =
                        values.columns &&
                        Array.isArray(values.columns) &&
                        values.columns.some((col) => col?.group_by === true || isAggregateFunction(col?.function));
                    if (!hasGroupBy) {
                        errors.havings = t("boards.errors.havingGroupByRequired");
                    }
                }
                return errors;
            }}
            onSubmit={(...args) => {
                const [values, ...rest] = args;
                const hasGroupByColumn =
                    Array.isArray(values?.columns) &&
                    values.columns.some((column) => column?.group_by === true || isAggregateFunction(column?.function));
                const hasHavingCondition = Array.isArray(values?.havings) && values.havings.length > 0;
                const mustDisableBulkActions =
                    !supportsBulkActions(values?.primary_entity) || hasGroupByColumn || hasHavingCondition;
                const mustDisableDeleteRecord =
                    !values?.primary_entity?.startsWith("aux_") || hasGroupByColumn || hasHavingCondition;
                let payload = { ...values };
                if (mustDisableBulkActions) {
                    payload = {
                        ...payload,
                        can_admin_bulk_actions: false,
                        can_agent_bulk_actions: false,
                    };
                }
                if (mustDisableDeleteRecord) {
                    payload = {
                        ...payload,
                        can_admin_delete_record: false,
                        can_agent_delete_record: false,
                    };
                }
                if (!payload?.quick_ans_filter?.enabled) {
                    payload = {
                        ...payload,
                        quick_ans_filter: BOARDS_DETAILS.INITIAL_VALUES.quick_ans_filter,
                    };
                }
                return handlerSubmit(payload, ...rest);
            }}
        >
            {({ values, errors, setFieldValue, initialValues }) => {
                const hasGroupByColumn =
                    Array.isArray(values?.columns) &&
                    values.columns.some((column) => column?.group_by === true || isAggregateFunction(column?.function));
                const hasHavingCondition = Array.isArray(values?.havings) && values.havings.length > 0;
                const showBulkActionsSwitches = supportsBulkActions(values?.primary_entity);
                const showDeleteRecordSwitches = values?.primary_entity?.startsWith("aux_");
                const disableByGrouping = hasGroupByColumn || hasHavingCondition;
                const ansColumnOptions = getAnsColumnOptions(values?.columns);
                const quickAnsEnabled = values?.quick_ans_filter?.enabled === true;
                const selectedAnsAlias = values?.quick_ans_filter?.ans_column_alias || "";
                const useDefaultAnsColors = values?.quick_ans_filter?.use_default_colors !== false;
                const defaultLabel = (position) =>
                    t(`boards.form.quickAnsFilter.labels.defaultLabel${position}`, {
                        defaultValue: QUICK_ANS_FILTER_DEFAULT_LABELS[position],
                    });
                return (
                    <Form data-testid="boards-form" autoComplete="off" className="flex flex-col gap-2">
                        <BulkActionsStateSync
                            isCasesEntity={showBulkActionsSwitches}
                            disableByGrouping={disableByGrouping}
                            t={t}
                        />
                        <DeleteActionsStateSync
                            isAuxEntity={showDeleteRecordSwitches}
                            disableByGrouping={disableByGrouping}
                            t={t}
                        />
                        <QuickAnsFilterStateSync />
                        <FormContent title={title} labelButton={labelButton} isSending={isPending} onBack={onBack}>
                            <div className="col-span-full flex w-full min-w-0 flex-col gap-4">
                                <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                                    <div className="flex h-full min-h-0 flex-col gap-4">
                                        <FormCard
                                            title="Detalles del tablero"
                                            description="Configura la información básica de tu tablero"
                                        >
                                            <InputField
                                                label="Nombre"
                                                placeholder="Nombre del tablero"
                                                data-testid="name-input"
                                                error={errors.name}
                                                initialValue={initialValues?.name || ""}
                                                value={values?.name}
                                                onChange={(event) => setFieldValue("name", event.target.value)}
                                            />
                                            <InputField
                                                label="Descripción"
                                                placeholder="Descripción del tablero"
                                                data-testid="description-input"
                                                error={errors.description}
                                                initialValue={initialValues?.description || ""}
                                                value={values?.description}
                                                onChange={(event) => setFieldValue("description", event.target.value)}
                                            />
                                            <SelectField
                                                label="Entidades"
                                                placeholder="Seleccione..."
                                                options={entitiesOptions}
                                                defaultValue={initialValues?.primary_entity || ""}
                                                value={values?.primary_entity || ""}
                                                error={errors.primary_entity}
                                                onValueChange={(value) => {
                                                    setClearRows(true);
                                                    setFieldValue("primary_entity", value);
                                                    if (supportsBulkActions(value)) {
                                                        setFieldValue("can_admin_bulk_actions", true);
                                                        setFieldValue("can_agent_bulk_actions", true);
                                                    } else {
                                                        const missingBulkColumns =
                                                            getMissingBulkColumnsForEntity(value);
                                                        if (missingBulkColumns.length > 0) {
                                                            toast.warning(
                                                                t("boards.form.bulkActions.viewMissingColumns", {
                                                                    columns: missingBulkColumns.join(", "),
                                                                }),
                                                            );
                                                        }
                                                        setFieldValue("can_admin_bulk_actions", false);
                                                        setFieldValue("can_agent_bulk_actions", false);
                                                    }
                                                    if (!value?.startsWith("aux_")) {
                                                        setFieldValue("can_admin_delete_record", false);
                                                        setFieldValue("can_agent_delete_record", false);
                                                    }
                                                    setTimeout(() => setClearRows(false), 500);
                                                }}
                                            />
                                            {showBulkActionsSwitches && (
                                                <div className="grid md:grid-cols-2 gap-2">
                                                    <SwitchField
                                                        label={t("boards.form.labels.allowAdminBulkActions")}
                                                        data-testid="can-admin-bulk-actions-input"
                                                        checked={
                                                            disableByGrouping
                                                                ? false
                                                                : values?.can_admin_bulk_actions === true
                                                        }
                                                        disabled={disableByGrouping}
                                                        error={errors.can_admin_bulk_actions}
                                                        onCheckedChange={(value) =>
                                                            setFieldValue("can_admin_bulk_actions", value)
                                                        }
                                                    />
                                                    <SwitchField
                                                        label={t("boards.form.labels.allowAgentBulkActions")}
                                                        data-testid="can-agent-bulk-actions-input"
                                                        checked={
                                                            disableByGrouping
                                                                ? false
                                                                : values?.can_agent_bulk_actions === true
                                                        }
                                                        disabled={disableByGrouping}
                                                        error={errors.can_agent_bulk_actions}
                                                        onCheckedChange={(value) =>
                                                            setFieldValue("can_agent_bulk_actions", value)
                                                        }
                                                    />
                                                </div>
                                            )}
                                            {showDeleteRecordSwitches && (
                                                <div className="grid md:grid-cols-2 gap-2">
                                                    <SwitchField
                                                        label={t("boards.form.labels.allowAdminDeleteRecord")}
                                                        data-testid="can-admin-delete-record-input"
                                                        checked={
                                                            disableByGrouping
                                                                ? false
                                                                : values?.can_admin_delete_record === true
                                                        }
                                                        disabled={disableByGrouping}
                                                        error={errors.can_admin_delete_record}
                                                        onCheckedChange={(value) =>
                                                            setFieldValue("can_admin_delete_record", value)
                                                        }
                                                    />
                                                    <SwitchField
                                                        label={t("boards.form.labels.allowAgentDeleteRecord")}
                                                        data-testid="can-agent-delete-record-input"
                                                        checked={
                                                            disableByGrouping
                                                                ? false
                                                                : values?.can_agent_delete_record === true
                                                        }
                                                        disabled={disableByGrouping}
                                                        error={errors.can_agent_delete_record}
                                                        onCheckedChange={(value) =>
                                                            setFieldValue("can_agent_delete_record", value)
                                                        }
                                                    />
                                                </div>
                                            )}
                                            <div className="grid md:grid-cols-2 gap-2">
                                                <InputField
                                                    label="Registros por pagina"
                                                    placeholder="25"
                                                    type="number"
                                                    data-testid="page-size-input"
                                                    min={10}
                                                    max={100}
                                                    step={1}
                                                    error={errors.page_size}
                                                    value={values?.page_size ?? ""}
                                                    onChange={(event) => setFieldValue("page_size", event.target.value)}
                                                />
                                                <InputField
                                                    label="Orden de visualización"
                                                    placeholder="1"
                                                    type="number"
                                                    data-testid="display-order-input"
                                                    min={1}
                                                    max={9999}
                                                    step={1}
                                                    error={errors.display_order}
                                                    value={values?.display_order ?? ""}
                                                    onChange={(event) =>
                                                        setFieldValue("display_order", event.target.value)
                                                    }
                                                />
                                                <SelectField
                                                    key="onescript-form"
                                                    label="Formulario One Script"
                                                    placeholder="Seleccione..."
                                                    options={oneScriptOptions}
                                                    defaultValue={initialValues?.onescript_form_id || ""}
                                                    value={values?.onescript_form_id || ""}
                                                    error={errors.onescript_form_id}
                                                    onValueChange={(value) => setFieldValue("onescript_form_id", value)}
                                                    onSearch={onSearchOneScript}
                                                    fetchNextPage={fetchNextPageOneScript}
                                                    hasNextPage={hasNextPageOneScript}
                                                    isFetchingNextPage={isFetchingNextPageOneScript}
                                                    isLoading={isLoadingOneScriptOptions}
                                                />

                                                <MultiSelectGroups
                                                    label="Grupos"
                                                    initialGroups={initialValues?.access_groups || []}
                                                    error={errors.access_groups}
                                                    handlerChange={(value) => {
                                                        setFieldValue("access_groups", value);
                                                    }}
                                                />
                                                <MultiSelectUsers
                                                    label="Usuarios"
                                                    initialUsers={initialValues?.access_users || []}
                                                    error={errors.access_users}
                                                    handlerChange={(value) => {
                                                        setFieldValue("access_users", value);
                                                    }}
                                                />
                                            </div>
                                            <div className="grid md:grid-cols-3 gap-2">
                                                <SwitchField
                                                    label="Ver registro"
                                                    data-testid="can-view-record-input"
                                                    defaultChecked={initialValues?.can_view_record !== false}
                                                    error={errors.can_view_record}
                                                    onCheckedChange={(value) => setFieldValue("can_view_record", value)}
                                                />
                                                <SwitchField
                                                    label="Crear registro"
                                                    data-testid="can-create-record-input"
                                                    defaultChecked={initialValues?.can_create_record !== false}
                                                    error={errors.can_create_record}
                                                    onCheckedChange={(value) =>
                                                        setFieldValue("can_create_record", value)
                                                    }
                                                />
                                                <SwitchField
                                                    label="Editar registro"
                                                    data-testid="can-edit-record-input"
                                                    defaultChecked={initialValues?.can_edit_record !== false}
                                                    error={errors.can_edit_record}
                                                    onCheckedChange={(value) => setFieldValue("can_edit_record", value)}
                                                />
                                            </div>
                                            <div className="grid md:grid-cols-2 gap-2">
                                                <SwitchField
                                                    label="Estado"
                                                    data-testid="is-active-input"
                                                    defaultChecked={initialValues?.is_active || false}
                                                    error={errors.is_active}
                                                    onCheckedChange={(value) => setFieldValue("is_active", value)}
                                                />
                                                <SelectIconField
                                                    label="Icono"
                                                    selectedIconName={values?.icon_class || ""}
                                                    error={errors.icon_class}
                                                    onSelect={(value) => setFieldValue("icon_class", value)}
                                                />
                                            </div>
                                        </FormCard>

                                        <FormCard
                                            className="min-h-0 flex-1"
                                            title="Relaciones"
                                            description="Configura las relaciones para tu tablero"
                                            error={errors.relations}
                                        >
                                            <BoardsRelations
                                                initialData={values?.relations}
                                                primaryEntity={values?.primary_entity}
                                                clearRows={clearRows}
                                                onSubmit={(value) => setFieldValue("relations", value)}
                                            />
                                        </FormCard>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <FormCard
                                            title="Filtro base"
                                            description="Configura el filtro base para tu tablero"
                                            error={errors?.criteria?.items}
                                        >
                                            <BoardsInitialFilter
                                                initialData={values?.criteria}
                                                primaryEntity={values?.primary_entity}
                                                currentRelatedEntities={values?.relations || []}
                                                clearRows={clearRows}
                                                onSubmit={(value) => setFieldValue("criteria", { items: value })}
                                            />
                                        </FormCard>

                                        <FormCard
                                            title={t("boards.form.quickAnsFilter.title")}
                                            description={t("boards.form.quickAnsFilter.description")}
                                        >
                                            <div className="flex flex-col gap-2">
                                                <SwitchField
                                                    label={t("boards.form.quickAnsFilter.labels.enabled")}
                                                    data-testid="quick-ans-filter-enabled-input"
                                                    checked={quickAnsEnabled && ansColumnOptions.length > 0}
                                                    disabled={ansColumnOptions.length === 0}
                                                    onCheckedChange={(value) => {
                                                        setFieldValue("quick_ans_filter.enabled", value);
                                                        if (value && ansColumnOptions.length === 1) {
                                                            setFieldValue(
                                                                "quick_ans_filter.ans_column_alias",
                                                                ansColumnOptions[0].value,
                                                            );
                                                        }
                                                        if (!value) {
                                                            setFieldValue("quick_ans_filter.ans_column_alias", "");
                                                        }
                                                    }}
                                                />
                                                {ansColumnOptions.length === 0 && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {t("boards.form.quickAnsFilter.labels.noAnsColumns")}
                                                    </p>
                                                )}
                                                {quickAnsEnabled && ansColumnOptions.length > 1 && (
                                                    <SelectField
                                                        label={t("boards.form.quickAnsFilter.labels.ansColumn")}
                                                        placeholder={t(
                                                            "boards.form.quickAnsFilter.labels.ansColumnPlaceholder",
                                                        )}
                                                        options={ansColumnOptions}
                                                        value={selectedAnsAlias}
                                                        defaultValue={selectedAnsAlias}
                                                        error={errors?.quick_ans_filter?.ans_column_alias}
                                                        onValueChange={(value) =>
                                                            setFieldValue("quick_ans_filter.ans_column_alias", value)
                                                        }
                                                    />
                                                )}
                                                {quickAnsEnabled && (
                                                    <>
                                                        <div className="grid md:grid-cols-3 gap-2">
                                                            <InputField
                                                                label={t("boards.form.quickAnsFilter.labels.label1")}
                                                                placeholder={defaultLabel(1)}
                                                                data-testid="quick-ans-filter-label-1-input"
                                                                value={values?.quick_ans_filter?.labels?.[1] ?? ""}
                                                                onChange={(event) =>
                                                                    setFieldValue(
                                                                        "quick_ans_filter.labels.1",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            />
                                                            <InputField
                                                                label={t("boards.form.quickAnsFilter.labels.label2")}
                                                                placeholder={defaultLabel(2)}
                                                                data-testid="quick-ans-filter-label-2-input"
                                                                value={values?.quick_ans_filter?.labels?.[2] ?? ""}
                                                                onChange={(event) =>
                                                                    setFieldValue(
                                                                        "quick_ans_filter.labels.2",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            />
                                                            <InputField
                                                                label={t("boards.form.quickAnsFilter.labels.label3")}
                                                                placeholder={defaultLabel(3)}
                                                                data-testid="quick-ans-filter-label-3-input"
                                                                value={values?.quick_ans_filter?.labels?.[3] ?? ""}
                                                                onChange={(event) =>
                                                                    setFieldValue(
                                                                        "quick_ans_filter.labels.3",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        {typeof errors?.quick_ans_filter?.labels === "string" && (
                                                            <p className="text-xs text-red-500">
                                                                {t(
                                                                    "boards.form.quickAnsFilter.labels.labelsAllRequired",
                                                                )}
                                                            </p>
                                                        )}
                                                        <SwitchField
                                                            label={t(
                                                                "boards.form.quickAnsFilter.labels.useDefaultColors",
                                                            )}
                                                            data-testid="quick-ans-filter-use-default-colors-input"
                                                            checked={
                                                                values?.quick_ans_filter?.use_default_colors !== false
                                                            }
                                                            onCheckedChange={(value) =>
                                                                setFieldValue(
                                                                    "quick_ans_filter.use_default_colors",
                                                                    value,
                                                                )
                                                            }
                                                        />
                                                        {!useDefaultAnsColors && (
                                                            <div className="grid md:grid-cols-3 gap-2">
                                                                {[1, 2, 3].map((n) => (
                                                                    <FieldWrapper
                                                                        key={n}
                                                                        label={
                                                                            String(
                                                                                values?.quick_ans_filter?.labels?.[n] ??
                                                                                    "",
                                                                            ).trim() || defaultLabel(n)
                                                                        }
                                                                    >
                                                                        <div className="flex items-center gap-2 w-full">
                                                                            <input
                                                                                type="color"
                                                                                data-testid={`quick-ans-filter-color-${n}-input`}
                                                                                value={
                                                                                    values?.quick_ans_filter?.colors?.[
                                                                                        n
                                                                                    ] ||
                                                                                    QUICK_ANS_FILTER_DEFAULT_COLORS[n]
                                                                                }
                                                                                onChange={(event) =>
                                                                                    setFieldValue(
                                                                                        `quick_ans_filter.colors.${n}`,
                                                                                        event.target.value,
                                                                                    )
                                                                                }
                                                                                className="w-10 h-10 rounded cursor-pointer border border-input p-0.5"
                                                                            />
                                                                            <span className="text-sm text-muted-foreground font-mono">
                                                                                {values?.quick_ans_filter?.colors?.[
                                                                                    n
                                                                                ] || QUICK_ANS_FILTER_DEFAULT_COLORS[n]}
                                                                            </span>
                                                                        </div>
                                                                    </FieldWrapper>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {useDefaultAnsColors && (
                                                            <QuickAnsDefaultColorsPreview
                                                                defaultLabelByPosition={defaultLabel}
                                                            />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </FormCard>

                                        <FormCard
                                            title={t("boards.form.havings.title")}
                                            description={t("boards.form.havings.description")}
                                            error={errors.havings}
                                        >
                                            <BoardsHavings
                                                initialData={values?.havings || []}
                                                primaryEntity={values?.primary_entity}
                                                currentRelatedEntities={values?.relations || []}
                                                clearRows={clearRows}
                                                onSubmit={(value) => setFieldValue("havings", value)}
                                            />
                                        </FormCard>

                                        <FormCard
                                            title={t("boards.form.sorting.title")}
                                            description={t("boards.form.sorting.description")}
                                            error={errors.orders}
                                        >
                                            <BoardsSorting
                                                initialData={values?.orders || []}
                                                primaryEntity={values?.primary_entity}
                                                currentRelatedEntities={values?.relations || []}
                                                clearRows={clearRows}
                                                onSubmit={(value) => setFieldValue("orders", value)}
                                            />
                                        </FormCard>

                                        <FormCard
                                            title="Opciones disponibles"
                                            description="Configura las opciones para tu tablero"
                                            error={errors.options}
                                        >
                                            <BoardsOptions
                                                initialData={values?.options}
                                                primaryEntity={values?.primary_entity}
                                                onSubmit={(value) => setFieldValue("options", value)}
                                            />
                                        </FormCard>
                                    </div>
                                </div>

                                <FormCard
                                    title="Parámetros del tablero"
                                    description="Configura las columnas, funciones y condiciones para tu tablero"
                                    error={errors.columns}
                                >
                                    <BoardsParameters
                                        initialData={values?.columns}
                                        primaryEntity={values?.primary_entity}
                                        currentRelatedEntities={values?.relations || []}
                                        clearRows={clearRows}
                                        onSubmit={(value) => setFieldValue("columns", value)}
                                    />
                                    <SelectField
                                        key="onescript-filter"
                                        label={t("boards.form.labels.filterOnescript")}
                                        placeholder={t("common.select")}
                                        options={oneScriptOptions}
                                        defaultValue={initialValues?.filter_onescript_id || ""}
                                        value={values?.filter_onescript_id || ""}
                                        error={errors.filter_onescript_id}
                                        onValueChange={(value) => setFieldValue("filter_onescript_id", value)}
                                        onSearch={onSearchOneScript}
                                        fetchNextPage={fetchNextPageOneScript}
                                        hasNextPage={hasNextPageOneScript}
                                        isFetchingNextPage={isFetchingNextPageOneScript}
                                        isLoading={isLoadingOneScriptOptions}
                                        clearable
                                        onClear={() => setFieldValue("filter_onescript_id", "")}
                                    />
                                </FormCard>
                            </div>
                        </FormContent>
                    </Form>
                );
            }}
        </Formik>
    );
};

BoardsForm.propTypes = {
    title: PropTypes.string,
    labelButton: PropTypes.string,
    initialData: PropTypes.object,
    isPending: PropTypes.bool,
    handlerSubmit: PropTypes.func,
    onBack: PropTypes.func,
};

export default BoardsForm;
