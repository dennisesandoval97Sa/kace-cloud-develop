import PropTypes from "prop-types";
import { useMemo } from "react";
import { TextAreaForm as TextArea, InputForm as Input, Label, KField } from "@kace/ui-shared";
import { DatePickerWithRange } from "../../../components/ui-shared/src/components/DatePickerWithRange";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { useTranslation } from "react-i18next";
import { formatFieldName } from "../data/proccessData";

/**
 * Genera inputs dinámicos para definiciones auxiliares a partir de columnas aplanadas.
 * currentHeaders: [{ value, label, type, nameColumn }]
 * Se usa en exportación para construir criterios.
 */
export const AuxDefinitionDynamicFilters = ({ headers = [], setFieldValue, values }) => {
    const { t } = useTranslation();

    const inputDescriptors = useMemo(() => {
        return headers
            .filter((h) => h && h.nameColumn)
            .map((h) => {
                const typeNorm = (h.type || "string").toLowerCase();
                if (["string", "text", "email", "url", "phone"].includes(typeNorm)) {
                    return { kind: "text", ...h, inputType: typeNorm === "email" ? "email" : "text" };
                }
                if (["number", "integer", "float", "decimal"].includes(typeNorm)) {
                    return { kind: "number", ...h, inputType: "number" };
                }
                if (["date", "datetime"].includes(typeNorm)) {
                    return { kind: "date", ...h };
                }
                if (["boolean", "bool"].includes(typeNorm)) {
                    return { kind: "boolean", ...h };
                }
                if (["array", "object", "json"].includes(typeNorm)) {
                    return { kind: "raw", ...h };
                }
                return { kind: "text", ...h, inputType: "text" };
            });
    }, [headers]);

    if (!headers || headers.length === 0) return null;

    return (
        <div
            className="w-full flex flex-col gap-4 border border-input rounded-md p-4"
            id="aux_def_dynamic_filters"
            data-testid="aux_def_dynamic_filters"
        >
            <h3
                className="text-lg font-semibold text-center"
                id="aux_def_dynamic_filters_title"
                data-testid="aux_def_dynamic_filters_title"
            >
                {t("importExport.form.filterByModules")}
            </h3>
            <div className="flex flex-wrap gap-4">
                {inputDescriptors.map((desc) => {
                    const name = desc.nameColumn;
                    const value = values?.[name];
                    const formattedLabel = formatFieldName(desc.label);

                    if (desc.kind === "text" || desc.kind === "number") {
                        return (
                            <div className="p-2 rounded-md flex-1 min-w-[280px]" key={name}>
                                <Input
                                    label={formattedLabel}
                                    name={name}
                                    type={desc.inputType}
                                    className="grid-cols-1 items-start gap-1.5"
                                    classNameInput="col-span-1"
                                    value={value || ""}
                                    onChange={(e) => setFieldValue(name, e.target.value)}
                                    id={`aux_def_filter_${name}`}
                                    data-testid={`aux_def_filter_${name}`}
                                />
                            </div>
                        );
                    }
                    if (desc.kind === "boolean") {
                        return (
                            <div className="flex flex-col w-full items-center gap-3" key={name}>
                                <Label htmlFor={`aux_def_filter_${name}`} className="text-left test-sm w-full">
                                    {formattedLabel}
                                </Label>
                                <div className="flex-1 w-full">
                                    <SwitchStateAdmin
                                        name={name}
                                        checked={value === true}
                                        onCheckedChange={(val) => setFieldValue(name, val)}
                                        id={`aux_def_filter_${name}`}
                                        data-testid={`aux_def_filter_${name}`}
                                    />
                                </div>
                            </div>
                        );
                    }
                    if (desc.kind === "date") {
                        return (
                            <div className="p-2 rounded-md flex-1 min-w-[300px]" key={name}>
                                <Label htmlFor={`aux_def_filter_${name}`} className="mb-2">
                                    {formattedLabel}
                                </Label>
                                <DatePickerWithRange
                                    noInitialDate
                                    name={name}
                                    onChange={(val) => setFieldValue(name, val)}
                                    id={`aux_def_filter_${name}`}
                                    data-testid={`aux_def_filter_${name}`}
                                />
                            </div>
                        );
                    }
                    if (desc.kind === "raw") {
                        return (
                            <div className="p-2 rounded-md flex-1 min-w-[300px]" key={name}>
                                <KField>
                                    <TextArea
                                        name={name}
                                        id={`aux_def_filter_${name}`}
                                        label={`${formattedLabel} (${t("importExport.form.rawFilter")})`}
                                        value={value || ""}
                                        onChange={(e) => setFieldValue(name, e.target.value)}
                                        data-testid={`aux_def_filter_${name}`}
                                    />
                                </KField>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        </div>
    );
};

AuxDefinitionDynamicFilters.propTypes = {
    headers: PropTypes.array,
    setFieldValue: PropTypes.func,
    values: PropTypes.object,
};
