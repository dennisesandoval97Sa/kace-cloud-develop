import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import PropTypes from "prop-types";
import { useMemo, useCallback } from "react";
import useSchemaFields from "@/hooks/useSchemaFields";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";
import { Input } from "@kace/ui-shared";
import { formatTestId } from "@/utils/src/helpers";
import { HEADERS_CASES_TABLE } from "../../../Cases/data/Constants";
import { resolveNamespacedColumnLabel } from "@/services/createSchemaFilter";

const SUBCASOS_KEY = "subcasos";
const FECHA_VENCIMIENTO_KEY = "fecha_vencimiento";

const KEY_TRANSFORMS = {
    estado_actual: "estadoActual",
    nombre_cliente: "nombreCliente",
};

const toColumnKey = (rawKey) => KEY_TRANSFORMS[rawKey] || rawKey;

const toTitleCase = (str) =>
    String(str)
        .replace(/[_\s]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const normalizeEntries = (raw) => {
    if (Array.isArray(raw)) return raw.filter((e) => e && typeof e === "object");
    if (raw && typeof raw === "object") {
        return Object.entries(raw).map(([key, label]) => ({ key, label }));
    }
    return [];
};

const findNewSuffix = (entries) => {
    let n = 0;
    while (entries.some((e) => e._newSuffix === n)) n += 1;
    return n;
};

export const HeadersLabelsEditor = ({ value, setFieldValue, name = "headers_labels" }) => {
    const { t } = useTranslation();
    const { schemaFields } = useSchemaFields();

    const allowedColumns = useMemo(() => {
        const schemaByName = new Map((schemaFields?.cases || []).map((field) => [field.column_name, field]));
        /*
         * These options describe columns of the Cases table (headers_labels config is Cases-only),
         * which CasesTableComponent's own resolveHeader resolves by checking gridMain.columnsCases.*
         * before falling back to the shared gridMain.columns.* key via the same
         * resolveNamespacedColumnLabel used here, so this editor can't drift from a different default
         * label than the table it configures.
         */
        const resolveLabelText = (fallbackLabel, defaultText) =>
            resolveNamespacedColumnLabel(t, fallbackLabel) ?? defaultText;
        const resolveLabel = (rawKey, columnKey, schemaField) =>
            resolveLabelText(schemaField?.label || rawKey, schemaField?.label || toTitleCase(columnKey));
        const baseOptions = HEADERS_CASES_TABLE.map((entry) => {
            const columnKey = toColumnKey(entry.key);
            const field = schemaByName.get(columnKey) || schemaByName.get(entry.key);
            return {
                value: columnKey,
                label: resolveLabel(entry.key, columnKey, field),
            };
        });
        if (!baseOptions.some((opt) => opt.value === FECHA_VENCIMIENTO_KEY)) {
            const field = schemaByName.get(FECHA_VENCIMIENTO_KEY);
            baseOptions.push({
                value: FECHA_VENCIMIENTO_KEY,
                label: resolveLabel(FECHA_VENCIMIENTO_KEY, FECHA_VENCIMIENTO_KEY, field),
            });
        }
        if (!baseOptions.some((opt) => opt.value === SUBCASOS_KEY)) {
            const subcasosField = schemaByName.get(SUBCASOS_KEY);
            const label = resolveLabelText("subcases", subcasosField?.label || toTitleCase(SUBCASOS_KEY));
            baseOptions.push({
                value: SUBCASOS_KEY,
                label,
            });
        }
        return baseOptions;
    }, [schemaFields, t]);

    const rawEntries = useMemo(() => normalizeEntries(value), [value]);
    const usedKeys = useMemo(() => new Set(rawEntries.map((e) => e.key).filter(Boolean)), [rawEntries]);

    const writeEntries = useCallback(
        (next) => {
            const cleaned = next.map(({ key, label }) => ({ key, label }));
            setFieldValue(name, cleaned);
        },
        [name, setFieldValue],
    );

    const handleAdd = useCallback(() => {
        const suffix = findNewSuffix(rawEntries);
        writeEntries([...rawEntries, { key: "", label: "", _newSuffix: suffix }]);
    }, [rawEntries, writeEntries]);

    const handleRemove = useCallback(
        (index) => {
            writeEntries(rawEntries.filter((_, i) => i !== index));
        },
        [rawEntries, writeEntries],
    );

    const handleLabelChange = useCallback(
        (index, label) => {
            writeEntries(rawEntries.map((e, i) => (i === index ? { ...e, label } : e)));
        },
        [rawEntries, writeEntries],
    );

    const handleColumnChange = useCallback(
        (index, nextColumn) => {
            writeEntries(rawEntries.map((e, i) => (i === index ? { ...e, key: nextColumn } : e)));
        },
        [rawEntries, writeEntries],
    );

    const optionsForRow = useCallback(
        (currentKey) => allowedColumns.filter((opt) => opt.value === currentKey || !usedKeys.has(opt.value)),
        [allowedColumns, usedKeys],
    );

    return (
        <div data-testid={formatTestId("headers_labels", "section")} className="flex w-full flex-col gap-2">
            <div className="text-sm font-semibold">{t("generalSetup.form.labels.headers_labels_section")}</div>
            <div
                data-testid={formatTestId("headers_labels", "list")}
                className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-2"
            >
                {rawEntries.length === 0 ? (
                    <div
                        data-testid={formatTestId("headers_labels", "empty")}
                        className="rounded border border-dashed border-muted-foreground/40 p-4 text-sm text-muted-foreground"
                    >
                        {t("generalSetup.form.labels.headers_labels_empty")}
                    </div>
                ) : (
                    rawEntries.map((entry, index) => {
                        const rowId = `row_${index}`;
                        return (
                            <div
                                key={entry._newSuffix ?? index}
                                data-testid={formatTestId("headers_labels", rowId)}
                                className="grid grid-cols-[minmax(180px,1fr)_minmax(0,2fr)_auto] items-start gap-2"
                            >
                                <SelectField
                                    data-testid={`headers_labels_select_${rowId}`}
                                    label={t("generalSetup.form.labels.headers_labels_column")}
                                    options={optionsForRow(entry.key)}
                                    value={entry.key || ""}
                                    onValueChange={(v) => handleColumnChange(index, v)}
                                />
                                <FieldWrapper label={t("generalSetup.form.labels.headers_labels_label")}>
                                    <Input
                                        data-testid={`headers_labels_input_${rowId}`}
                                        name={`headers_labels_label_${index}`}
                                        value={entry.label || ""}
                                        onChange={(e) => handleLabelChange(index, e.target.value)}
                                        autoComplete="off"
                                    />
                                </FieldWrapper>
                                <button
                                    type="button"
                                    data-testid={`headers_labels_remove_${rowId}`}
                                    aria-label={t("generalSetup.form.labels.headers_labels_remove")}
                                    onClick={() => handleRemove(index)}
                                    className="mt-7 inline-flex h-9 w-9 shrink-0 items-center justify-center self-start rounded border border-input hover:bg-accent"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        );
                    })
                )}
                <button
                    type="button"
                    data-testid={formatTestId("headers_labels", "add")}
                    onClick={handleAdd}
                    className="inline-flex w-fit items-center gap-1 self-start rounded border border-input px-3 py-1 text-sm hover:bg-accent"
                >
                    <Plus className="h-4 w-4" />
                    {t("generalSetup.form.labels.headers_labels_add")}
                </button>
            </div>
        </div>
    );
};

HeadersLabelsEditor.propTypes = {
    value: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
    setFieldValue: PropTypes.func.isRequired,
    name: PropTypes.string,
};

export default HeadersLabelsEditor;
