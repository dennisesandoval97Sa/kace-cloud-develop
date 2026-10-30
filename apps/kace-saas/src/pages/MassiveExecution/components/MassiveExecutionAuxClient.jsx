import { Badge, Button, GeneralLoader, Label } from "@/components/ui-shared";
import { X } from "lucide-react";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import MassiveExecutionSelect from "@/pages/MassiveExecution/components/MassiveExecutionSelect";
import MassiveExecutionInput from "@/pages/MassiveExecution/components/MassiveExecutionInput";
import useMassiveExecutionClients from "@/pages/MassiveExecution/hooks/useMassiveExecutionClients";
import { insertByRoute } from "@/pages/MassiveExecution/utils/insertByRoute";
import { parseInputType } from "@/pages/MassiveExecution/utils/parseInputType";

const buildCriteria = (filters) => {
    let criteria = {};
    for (const filter of filters) {
        criteria = insertByRoute(criteria, filter.route, parseInputType(filter.value));
    }
    return criteria;
};

const MassiveExecutionAuxClient = forwardRef(({ onChange }, ref) => {
    const { t } = useTranslation();
    const { clientRoutesOptions: options, loading } = useMassiveExecutionClients();
    const [filters, setFilters] = useState([]);
    const [selectedField, setSelectedField] = useState("");
    const [searchValue, setSearchValue] = useState("");
    const [route, setRoute] = useState("");

    // También cubre el montaje (emite `{}`). `onChange` debe ser estable (useCallback): si cambia en
    // cada render, este efecto se re-ejecuta en bucle.
    useEffect(() => {
        onChange(buildCriteria(filters));
    }, [filters, onChange]);

    const pendingFilter = () => {
        const currentValue = searchValue.trim();
        if (!selectedField || !currentValue) return null;
        const fieldData = options?.fields?.find((f) => f.id === selectedField);
        const routeData = options?.routes?.find((r) => r.id === route);
        if (!fieldData || !routeData) return null;
        return {
            route: `${routeData.label}|${fieldData.label}`,
            label: fieldData.label,
            value: currentValue,
        };
    };

    const addFilter = () => {
        const newFilter = pendingFilter();
        if (newFilter) {
            setFilters((prev) => {
                const existingIndex = prev.findIndex((f) => f.route === newFilter.route);
                if (existingIndex !== -1) {
                    const updatedFilters = [...prev];
                    updatedFilters[existingIndex] = newFilter;
                    return updatedFilters;
                }
                return [...prev, newFilter];
            });

            setSelectedField("");
            setSearchValue("");
        }
    };

    useImperativeHandle(
        ref,
        () => ({
            getCriteria: () => {
                const newFilter = pendingFilter();
                if (!newFilter) return buildCriteria(filters);
                const existingIndex = filters.findIndex((f) => f.route === newFilter.route);
                const mergedFilters =
                    existingIndex !== -1
                        ? filters.map((f, i) => (i === existingIndex ? newFilter : f))
                        : [...filters, newFilter];
                return buildCriteria(mergedFilters);
            },
        }),
        [filters, selectedField, searchValue, route, options],
    );

    const removeFilter = (routeToRemove) => {
        setFilters((prev) => prev.filter((f) => f.route !== routeToRemove));
    };

    const clearFilters = () => {
        setFilters([]);
        setSelectedField("");
        setSearchValue("");
    };

    return loading && options?.routes && options.routes.length === 0 ? (
        <GeneralLoader />
    ) : (
        <div className="space-y-6 pb-3">
            <div className="flex flex-col justify-stretch gap-2">
                {options?.routes && options.routes.length > 0 && (
                    <div className="flex flex-col gap-3 justify-stretch">
                        <Label className="text-left ml-2">{t("massiveExecution.auxClient.route")}</Label>
                        <MassiveExecutionSelect
                            className="w-full"
                            popOverClassName="w-[80vw]"
                            value={route}
                            options={options.routes}
                            onChange={(value) => {
                                setRoute(value);
                                clearFilters();
                            }}
                        />
                    </div>
                )}

                {route && options?.fields && options.fields.length > 0 && (
                    <div className="flex flex-col gap-2 w-full">
                        <Label className="text-left ml-2">{t("massiveExecution.auxClient.field")}</Label>
                        <div className="flex gap-3">
                            <div className="flex flex-1">
                                <MassiveExecutionSelect
                                    className="w-full"
                                    value={selectedField}
                                    options={options.fields.filter((f) => f.routeId === route)}
                                    onChange={(value) => setSelectedField(value)}
                                />
                            </div>
                            <MassiveExecutionInput
                                defaultValue={searchValue}
                                handleChange={(e) => setSearchValue(e?.target?.value ?? e)}
                            />
                            <Button onClick={addFilter} disabled={!selectedField || !searchValue.trim()}>
                                {t("massiveExecution.auxClient.add")}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {filters.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                        {t("massiveExecution.auxClient.activeFilters")}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {filters.map((filter, index) => (
                            <Badge key={index} variant="secondary" className="px-3 py-1">
                                <span className="font-medium">{filter.label}:</span>
                                <span className="ml-1">{filter.value}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-2 h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={() => removeFilter(filter.route)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

MassiveExecutionAuxClient.displayName = "MassiveExecutionAuxClient";

export default MassiveExecutionAuxClient;
