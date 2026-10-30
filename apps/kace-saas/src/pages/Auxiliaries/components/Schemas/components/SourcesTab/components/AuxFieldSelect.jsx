import { useEffect, useMemo, useState } from "react";
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from "@/components/ui-shared";
import PropTypes from "prop-types";
import { useFormikContext } from "formik";
import { useQuery } from "@tanstack/react-query";
// replaced MultiSelect with a plain input and local validation
import { fetchRulesBySchema } from "@/hooks/useAuxiliariesOptions";
import { useTranslation } from "react-i18next";
import { buildAuxClientsRoutesObjects } from "@/pages/MassiveExecution/utils/extractAuxClientsRoutes";

const AuxFieldSelect = ({
    field,
    fieldIndex,
    selectedAuxId,
    selectedAuxSchemaId,
    selectedAuxField: propSelectedAuxField,
    onChangeAuxField,
    showLabel = true,
    error: externalError,
    touched: externalTouched,
    onDataLoaded,
}) => {
    const selectedAuxField = propSelectedAuxField ?? null;
    const { t } = useTranslation();

    const { data: auxRulesData, isLoading: isFetchingAuxRules } = useQuery({
        queryKey: ["schemaRules", selectedAuxSchemaId],
        queryFn: () => fetchRulesBySchema(selectedAuxSchemaId),
        enabled: !!selectedAuxSchemaId,
    });

    // Notificar al padre cuando los datos terminen de cargar
    useEffect(() => {
        if (onDataLoaded && !isFetchingAuxRules && auxRulesData) {
            onDataLoaded();
        }
    }, [isFetchingAuxRules, auxRulesData, onDataLoaded]);

    // Usar useFormikContext solo si está disponible (contexto opcional)
    let values = {};
    try {
        const formikContext = useFormikContext();
        values = formikContext.values;
    } catch (e) {
        // Errors are intentionally not logged or thrown to prevent flow interruption
        values = {};
    }

    useEffect(() => {
        if (propSelectedAuxField !== undefined || !onChangeAuxField) return;

        const sources = values.fields?.[fieldIndex]?.sources ?? {};
        const aux = sources.auxiliaries_source || sources.aux || "";
        if (!aux) return;

        let fieldParam = null;
        try {
            const u = new URL(String(aux));
            fieldParam = u.searchParams.get("field");
        } catch {
            const m = String(aux).match(/[?&]field=([^&]+)/);
            if (m) fieldParam = m[1];
        }

        if (fieldParam) onChangeAuxField(fieldParam);
    }, [values.fields, fieldIndex, propSelectedAuxField, onChangeAuxField]);

    const selectedAuxRules = useMemo(() => {
        if (!auxRulesData) return [];

        try {
            const { routes = [], fields = [] } = buildAuxClientsRoutesObjects(
                auxRulesData,
                auxRulesData?.name ?? "aux",
            );
            const routeById = new Map(routes.map((r) => [r.id, r.label]));

            return fields.map((f) => {
                const routeLabel = routeById.get(f.routeId) || "";
                const base = routeLabel.split("|").join(".");
                const dotted = base ? `${base}.${f.label}` : f.label;
                return { id: dotted, value: dotted, label: dotted };
            });
        } catch {
            const auxFields = auxRulesData?.data_structure ?? {};
            return Object.keys(auxFields).map((key) => ({ id: key, value: key, label: key }));
        }
    }, [auxRulesData]);

    const selectedAuxFieldMemo = useMemo(() => {
        return selectedAuxField
            ? [
                  {
                      id: selectedAuxField,
                      value: selectedAuxField,
                      label: selectedAuxField,
                  },
              ]
            : [];
    }, [selectedAuxField]);

    const [inputValue, setInputValue] = useState(selectedAuxField ?? "");
    const [error, setError] = useState("");
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    // Combinar error interno con error externo si existe
    const displayError = externalError || error;

    // set of valid ids for quick lookup
    const validIds = useMemo(() => new Set(selectedAuxRules.map((r) => r.id)), [selectedAuxRules]);

    useEffect(() => {
        // keep local input in sync when selectedAuxField prop changes
        setInputValue(selectedAuxField ?? "");
        setError("");
    }, [selectedAuxField]);

    const validateAndNotify = (val) => {
        if (!val) {
            setError("");
            if (onChangeAuxField) onChangeAuxField(val);
            return;
        }

        if (validIds.has(val)) {
            setError("");
            if (onChangeAuxField) onChangeAuxField(val);
        } else {
            const msg = t("auxSchema.form.auxFieldInvalid") || "Aux field does not match any known route";
            setError(msg);
        }
    };
    const filteredOptions = useMemo(() => {
        const q = String(search ?? "")
            .trim()
            .toLowerCase();
        if (!q) return selectedAuxRules;
        return selectedAuxRules.filter((r) =>
            String(r.label ?? r.id ?? "")
                .toLowerCase()
                .includes(q),
        );
    }, [selectedAuxRules, search]);

    const selectOption = (id) => {
        setInputValue(id);
        setError("");
        if (onChangeAuxField) onChangeAuxField(id);
        setOpen(false);
        setSearch("");
    };

    if (!selectedAuxId && !selectedAuxSchemaId) return null;

    return (
        <div className="w-full">
            {showLabel && <label className="text-sm font-medium text-slate-700">{t("auxSchema.form.auxField")}</label>}

            <div className="w-full">
                <input
                    type="text"
                    readOnly
                    onClick={() => setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpen(true);
                        }
                    }}
                    className={`w-full px-3 py-2 rounded border ${(displayError && externalTouched) || displayError ? "border-red-500" : "border-gray-300"} bg-white text-sm outline-none overflow-x-auto whitespace-nowrap cursor-pointer`}
                    placeholder={selectedAuxFieldMemo?.[0]?.label ?? t("auxSchema.form.auxField")}
                    value={inputValue}
                    disabled={isFetchingAuxRules}
                />
            </div>

            <CommandDialog
                open={open}
                onOpenChange={(v) => {
                    setOpen(v);
                    if (!v) setSearch("");
                }}
            >
                <CommandInput
                    value={search}
                    onValueChange={(val) => setSearch(val)}
                    placeholder={t("search") || "Search..."}
                />
                <CommandList>
                    {filteredOptions.length === 0 && (
                        <CommandEmpty>{t("noResults") || "No results found."}</CommandEmpty>
                    )}

                    {isFetchingAuxRules ? (
                        <div className="p-2">
                            <p className="text-sm text-gray-500">{t("loading") || "Loading..."}</p>
                        </div>
                    ) : (
                        <div className="p-1">
                            {filteredOptions.map((opt) => (
                                <div key={opt.id} className="p-1">
                                    <button
                                        onClick={() => selectOption(opt.id)}
                                        className={`w-full text-left px-3 py-2 rounded-md border ${opt.id === inputValue ? "bg-blue-100 border-blue-300 text-blue-800" : "bg-white border-slate-200 text-slate-800"}`}
                                    >
                                        <div className="overflow-x-auto whitespace-nowrap">{opt.label}</div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </CommandList>
            </CommandDialog>

            {displayError && externalTouched && <p className="text-sm text-red-600 mt-1">{displayError}</p>}
        </div>
    );
};

AuxFieldSelect.propTypes = {
    field: PropTypes.string,
    fieldIndex: PropTypes.number,
    selectedAuxId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    selectedAuxSchemaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    selectedAuxField: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onChangeAuxField: PropTypes.func,
    showLabel: PropTypes.bool,
    error: PropTypes.string,
    touched: PropTypes.bool,
    onDataLoaded: PropTypes.func,
};

export default AuxFieldSelect;
