import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { useFormikContext } from "formik";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { InputForm as Input } from "@kace/ui-shared";
import InputCard from "@/components/core/Cards/InputCard";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { Button, DatePicker, Switch } from "@/components/ui-shared";
import Select from "@/componentsV2/core/Select";
import CalculatedFieldFunctions from "./CalculatedFieldFunctions";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { ERROR_POLICY_OPTIONS, ON_OPTIONS } from "../utils/calculatedFields";
import { MinusCircle, PlusCircle } from "lucide-react";

const SchemasCalculatedField = ({ namePrefix, index }) => {
    const { t } = useTranslation();
    const { values, setFieldValue } = useFormikContext();

    const { data: functionsData } = useGenericViewQuery({
        url: URL_AND_KEYS.schemaFunctions.url,
        keyQuery: URL_AND_KEYS.schemaFunctions.key,
    });

    const findFunctionInFunctionsData = (name) => {
        if (!name) return null;
        const d = functionsData;
        if (!d || typeof d !== "object") return null;
        for (const key of Object.keys(d)) {
            const arr = d[key] || [];
            const found = arr.find((f) => f.name === name || f.function_name === name);
            if (found) return found;
        }
        return null;
    };

    const parseFormula = (formula) => {
        if (!formula || typeof formula !== "string") return { functionName: null, args: [] };
        const formulaParts = formula.match(/^\s*([\w$]+)\s*\((.*)\)\s*$/);
        if (!formulaParts) return { functionName: null, args: [] };
        const functionName = formulaParts[1];
        const argsRaw = formulaParts[2].trim();
        const parameters = [];
        let cur = "";
        let quoteChar = null;
        for (const ch of argsRaw) {
            if ((ch === '"' || ch === "'") && quoteChar === null) {
                quoteChar = ch;
                cur += ch;
                continue;
            }
            if (ch === quoteChar) {
                quoteChar = null;
                cur += ch;
                continue;
            }
            if (ch === "," && quoteChar === null) {
                parameters.push(cur.trim());
                cur = "";
                continue;
            }
            cur += ch;
        }
        if (cur.trim() !== "") parameters.push(cur.trim());

        const args = parameters.filter(Boolean).map((p) => {
            const refMatch = p.match(/^ref\((.+)\)$/i);
            if (refMatch) {
                let raw = refMatch[1].trim();
                const quoted = raw.match(/^"(.*)"$/s) || raw.match(/^'(.*)'$/s);
                if (quoted) raw = quoted[1];
                return { isRef: true, value: raw };
            }
            const quoted = p.match(/^"(.*)"$/s) || p.match(/^'(.*)'$/s);
            if (quoted) return { isRef: false, value: quoted[1] };
            if (p === "true" || p === "false") return { isRef: false, value: p === "true" };
            const num = Number(p);
            if (!Number.isNaN(num)) return { isRef: false, value: num };
            return { isRef: false, value: p };
        });
        return { functionName, args };
    };

    const [localFunction, setLocalFunction] = useState(null);
    const [localParams, setLocalParams] = useState([]);
    const lastSetFormulaRef = useRef(undefined);
    const lastExternalFormulaRef = useRef(undefined);

    const buildLocalParams = (parsedArgsList, functionDef) => {
        const paramsDef = functionDef?.params ?? [];
        const args = Array.isArray(parsedArgsList) ? parsedArgsList : [];

        const makeParam = (a) => ({ isRef: !!a?.isRef, value: a?.value });

        if (!Array.isArray(paramsDef) || paramsDef.length === 0) {
            return args.map(makeParam);
        }

        const res = [];
        let ai = 0;

        for (const pdef of paramsDef) {
            if (pdef?.variadic) {
                const rest = args.slice(ai).map(makeParam);
                const allRefs = rest.length > 0 && rest.every((r) => !!r.isRef);
                res.push({ isRef: allRefs, value: rest });
                ai = args.length;
            } else {
                const a = args[ai];
                if (a) {
                    res.push(makeParam(a));
                    ai++;
                } else {
                    res.push({ isRef: false, value: undefined });
                }
            }
        }

        return res;
    };

    const schemaFields = useMemo(
        () => values?.fields?.map((f) => ({ value: f.name, label: f.name }))?.filter((_, i) => i !== index) ?? [],
        [values?.fields, index],
    );

    useEffect(() => {
        if (!functionsData) return;
        const initialFormula = values.fields?.[index]?.calc?.formula ?? null;
        if (!initialFormula) return;
        const parsed = parseFormula(initialFormula);
        const fd = findFunctionInFunctionsData(parsed.functionName);
        if (fd) {
            const fnName = fd.function_name ?? fd.name;
            setLocalFunction({ ...fd, name: fnName, function_name: fnName });
            const parsedArgs = parsed.args ?? [];
            const built = buildLocalParams(parsedArgs, fd);
            if (built.length > 0) setLocalParams(built);
            else
                setLocalParams(fd.params?.map((p) => ({ isRef: !!p.isRef, value: p.variadic ? [] : undefined })) ?? []);
        } else if (parsed.functionName) {
            setLocalFunction({ name: parsed.functionName, function_name: parsed.functionName, params: [] });
            setLocalParams(parsed.args?.map((a) => ({ isRef: !!a.isRef, value: a.value })) ?? []);
        } else {
            setLocalFunction(null);
            setLocalParams([]);
        }
        lastExternalFormulaRef.current = initialFormula;
    }, [functionsData]);

    const updateLocalParam = useCallback((paramIndex, next) => {
        setLocalParams((prev) => {
            const copy = [...(prev || [])];
            const existing = copy[paramIndex] || { isRef: false, value: undefined };
            copy[paramIndex] = { ...existing, ...next };
            return copy;
        });
    }, []);

    const addVariadicEntry = useCallback((paramIndex) => {
        setLocalParams((prev) => {
            const copy = [...(prev || [])];
            const existing = copy[paramIndex] || { isRef: false, value: undefined };
            let arr;
            if (Array.isArray(existing.value)) arr = [...existing.value];
            else if (existing.value === undefined) arr = [];
            else arr = [existing.value];
            arr.push({ isRef: false, value: undefined });
            copy[paramIndex] = { ...existing, value: arr };
            return copy;
        });
    }, []);

    const removeVariadicEntry = useCallback((paramIndex, entryIndex) => {
        setLocalParams((prev) => {
            const copy = [...(prev || [])];
            const existing = copy[paramIndex] || { isRef: false, value: undefined };
            let arr;
            if (Array.isArray(existing.value)) arr = [...existing.value];
            else if (existing.value === undefined) arr = [];
            else arr = [existing.value];
            arr.splice(entryIndex, 1);
            copy[paramIndex] = { ...existing, value: arr };
            return copy;
        });
    }, []);

    const updateVariadicEntry = useCallback((paramIndex, entryIndex, next) => {
        setLocalParams((prev) => {
            const copy = [...(prev || [])];
            const existing = copy[paramIndex] || { isRef: false, value: undefined };
            let arr;
            if (Array.isArray(existing.value)) arr = [...existing.value];
            else if (existing.value === undefined) arr = [];
            else arr = [existing.value];
            const existingEntry = arr[entryIndex] || { isRef: false, value: undefined };
            if (next && typeof next === "object" && (Object.hasOwn(next, "isRef") || Object.hasOwn(next, "value"))) {
                arr[entryIndex] = { ...existingEntry, ...next };
            } else {
                arr[entryIndex] = { ...existingEntry, value: next };
            }
            copy[paramIndex] = { ...existing, value: arr };
            return copy;
        });
    }, []);

    const normalizeToUtcMidnightIso = (input) => {
        if (!input) return undefined;
        if (typeof input === "string") {
            const d = new Date(input.replaceAll("/", "-"));
            if (Number.isNaN(d.getTime())) return undefined;
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
        }
        if (input instanceof Date) {
            const d = input;
            return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString();
        }
        return undefined;
    };

    const formatParamToPart = (parameter, parameterDefinition) => {
        if (!parameter) return "";
        if (parameter.isRef)
            return parameter.value !== undefined && parameter.value !== null && parameter.value !== ""
                ? `ref(${parameter.value})`
                : "";
        if (parameterDefinition?.type === "string") return `"${parameter.value ?? ""}"`;
        if (parameterDefinition?.type === "number")
            return parameter.value !== undefined && parameter.value !== null ? String(parameter.value) : "";
        if (parameterDefinition?.type === "boolean") return parameter.value ? "true" : "false";
        const dateLike = ((val) => {
            if (!val) return "";
            if (val instanceof Date)
                return `"${new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate())).toISOString()}"`;
            if (typeof val === "string") {
                const d = new Date(val);
                if (Number.isNaN(d.getTime())) return "";
                return `"${new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()}"`;
            }
            return "";
        })(parameter.value);
        if (dateLike) return dateLike;
        return parameter.value ?? "";
    };

    const updateField = useCallback(() => {
        const fnName = localFunction?.name;
        if (!fnName) return;
        const functionObject = findFunctionInFunctionsData(fnName);
        const partsArr = [];
        const paramsDef = functionObject?.params ?? [];
        const getParamValues = (p) => {
            if (!p) return [];
            if (Array.isArray(p.value)) return p.value;
            if (p.value === undefined) return [];
            return [p.value];
        };
        const pushPart = (p, pdef) => {
            const part = formatParamToPart(p, pdef);
            if (part !== "" && part !== undefined && part !== null) partsArr.push(part);
        };

        for (const [i, p] of Object.entries(localParams ?? [])) {
            const idx = Number(i);
            const pdef = paramsDef[idx];
            if (pdef?.variadic) {
                const vals = getParamValues(p);
                for (const entry of vals) {
                    const part = formatParamToPart({ isRef: !!entry?.isRef, value: entry?.value }, pdef);
                    if (part !== "" && part !== undefined && part !== null) partsArr.push(part);
                }
            } else {
                pushPart(p, pdef);
            }
        }
        const parts = partsArr.join(", ");
        const formula = `${fnName}(${parts})`;
        const currentFormula = values.fields?.[index]?.calc?.formula ?? undefined;
        if (formula !== currentFormula) {
            setFieldValue(`${namePrefix}.calc.formula`, formula);
            lastSetFormulaRef.current = formula;
        }
    }, [localFunction, localParams, values.fields, index]);

    useEffect(() => {
        const externalFormula = values.fields?.[index]?.calc?.formula ?? null;
        if (externalFormula === lastSetFormulaRef.current) {
            lastExternalFormulaRef.current = externalFormula;
            return;
        }
        if (externalFormula !== lastExternalFormulaRef.current) {
            const parsed = parseFormula(externalFormula);
            const fd = findFunctionInFunctionsData(parsed.functionName);
            if (fd) {
                const fnName = fd.function_name ?? fd.name;
                setLocalFunction({ ...fd, name: fnName, function_name: fnName });
                const parsedArgs = parsed.args ?? [];
                if (parsedArgs.length > 0)
                    setLocalParams(parsedArgs.map((a) => ({ isRef: !!a.isRef, value: a.value })));
                else setLocalParams(fd.params?.map(() => ({ isRef: false, value: undefined })) ?? []);
            } else if (parsed.functionName) {
                setLocalFunction({ name: parsed.functionName, function_name: parsed.functionName, params: [] });
                setLocalParams(parsed.args?.map((a) => ({ isRef: !!a.isRef, value: a.value })) ?? []);
            } else {
                setLocalFunction(null);
                setLocalParams([]);
            }
            lastExternalFormulaRef.current = externalFormula;
        }
    }, [values.fields, index, functionsData]);

    useEffect(() => {
        try {
            updateField();
        } catch (e) {
            // Errors are intentionally not logged or thrown to prevent flow interruption
        }
    }, [localParams, localFunction, updateField]);

    const renderParameterRef = (param, paramIndex, entryIndex) => {
        const localParameter = localParams[paramIndex] ?? { isRef: false, value: undefined };
        const type = param?.type ?? "string";

        const getEntryValue = () => {
            if (entryIndex === undefined) return localParameter.value;
            if (!Array.isArray(localParameter.value)) return undefined;
            const el = localParameter.value[entryIndex];
            if (el && typeof el === "object" && Object.hasOwn(el, "value")) return el.value;
            return el;
        };

        const setEntryValue = (next) => {
            if (entryIndex === undefined) {
                updateLocalParam(paramIndex, { value: next });
            } else {
                updateVariadicEntry(paramIndex, entryIndex, next);
            }
        };

        const entryVal = getEntryValue();

        if (type === "string")
            return (
                <Input
                    value={entryVal ?? ""}
                    label={param?.label}
                    type="text"
                    onChange={(e) => setEntryValue(e.target.value)}
                />
            );
        if (type === "number")
            return (
                <Input
                    value={entryVal ?? ""}
                    label={param?.label ?? param?.name ?? `param_${paramIndex}`}
                    type="number"
                    onChange={(e) => setEntryValue(e.target.value === "" ? undefined : Number(e.target.value))}
                />
            );
        if (type === "boolean")
            return (
                <InputCard>
                    <div className="flex items-center justify-between border-input border p-2 rounded-md">
                        <div className="flex flex-col">
                            <label className="font-semibold">{param?.name}</label>
                            <div className="text-sm">
                                {entryVal ? t("auxSchema.form.true") : t("auxSchema.form.false")}
                            </div>
                        </div>
                        <Switch checked={!!entryVal} onCheckedChange={(next) => setEntryValue(!!next)} />
                    </div>
                </InputCard>
            );
        if (type === "date") {
            const v = entryVal;
            let dpValue;
            if (v) {
                const iso = normalizeToUtcMidnightIso(v);
                if (iso) {
                    const utcDate = new Date(iso);
                    dpValue = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
                }
            }
            return (
                <DatePicker
                    label={param?.label}
                    value={dpValue}
                    onChange={(date) => {
                        if (!date) {
                            setEntryValue(undefined);
                            return;
                        }
                        const iso = normalizeToUtcMidnightIso(date);
                        setEntryValue(iso);
                    }}
                />
            );
        }
        return (
            <Input
                value={entryVal ?? ""}
                label={param?.label ?? param?.name}
                type="text"
                onChange={(e) => setEntryValue(e.target.value)}
            />
        );
    };

    const renderVariadicList = (param, paramIndex, parameterDefinition, localParameter) => {
        let vals;
        if (Array.isArray(localParameter.value)) vals = localParameter.value;
        else if (localParameter.value === undefined) vals = [];
        else vals = [localParameter.value];

        const nodes = [];
        for (let vi = 0; vi < vals.length; vi++) {
            const val = vals[vi];
            const onToggleRef = (next) => updateVariadicEntry(paramIndex, vi, { isRef: !!next });
            const onSetValue = (nextVal) => updateVariadicEntry(paramIndex, vi, { value: nextVal });

            let innerNode;
            if (val?.isRef) {
                if (schemaFields?.length) {
                    innerNode = (
                        <Select
                            t={t}
                            options={schemaFields}
                            label={`Reference for ${parameterDefinition.name} [${vi + 1}]`}
                            value={val?.value ?? ""}
                            onChangeHandler={onSetValue}
                            handlerClear={() => onSetValue(undefined)}
                        />
                    );
                } else {
                    innerNode = <p>{t("auxSchema.form.noFields")}</p>;
                }
            } else {
                innerNode = renderParameterRef(param, paramIndex, vi);
            }

            nodes.push(
                <InputCard className="flex items-center" key={`${paramIndex}-var-${vi}`}>
                    <div className="flex flex-1 items-center justify-between border-input border p-2 rounded-md">
                        <div className="flex flex-col gap-2">
                            <label className="font-semibold">{`${t("auxSchema.form.inputType")} '${parameterDefinition.name}'`}</label>
                            <div className="flex gap-2 items-center">
                                <Switch checked={!!val?.isRef} onCheckedChange={onToggleRef} />
                                <div className="text-sm">
                                    {t(val.isRef ? "auxSchema.form.reference" : "auxSchema.form.value")}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-start gap-2">{innerNode}</div>
                        <Button
                            type="button"
                            variant="destructive"
                            className="ml-2"
                            onClick={removeVariadicEntry.bind(null, paramIndex, vi)}
                        >
                            <MinusCircle />
                        </Button>
                    </div>
                </InputCard>,
            );
        }
        nodes.push(
            <div key={`${paramIndex}-var-add`}>
                <Button
                    type="button"
                    className="text-sm text-white gap-2 w-full"
                    onClick={() => addVariadicEntry(paramIndex)}
                >
                    <PlusCircle /> {t("auxSchema.form.addParameterEntry")}
                </Button>
            </div>,
        );
        return <div className="flex flex-col gap-2">{nodes}</div>;
    };

    const selectedErrorPolicy = useMemo(() => values.fields[index]?.calc?.error_policy, [values.fields?.[index]]);
    const selectedTrigger = useMemo(() => values.fields[index]?.calc?.on, [values.fields?.[index]]);
    const getTriggers = () => {
        const val = values.fields[index]?.calc?.on;
        if (Array.isArray(val)) return val;
        if (val) return [val];
        return [];
    };
    const handleFunctionSelect = (selectedFunction) => {
        setLocalFunction(selectedFunction);
        const paramsArr = Array.isArray(selectedFunction?.params) ? selectedFunction.params : [];
        const initialParams = paramsArr.map((p) => ({ isRef: !!p.isRef, value: p.variadic ? [] : undefined }));
        setLocalParams(initialParams);
    };

    return (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 border-l-4 border-gray-200 items-start">
            <InputCard className="col-span-2">
                <h3 className="mb-2 font-medium">{t("auxSchema.form.title.function", "Function")}</h3>
                <CalculatedFieldFunctions
                    onSelect={handleFunctionSelect}
                    initialValue={localFunction}
                    functionsData={functionsData}
                />
            </InputCard>

            {localFunction?.params?.map((param, paramIndex) => {
                const renderParamBlock = () => {
                    const parameterDefinition = localFunction.params[paramIndex] ?? {
                        name: param?.name ?? `param_${paramIndex}`,
                        isRef: false,
                    };
                    const localParameter = localParams[paramIndex] ?? { isRef: false, value: undefined };
                    let paramContent;
                    if (parameterDefinition.variadic) {
                        paramContent = renderVariadicList(param, paramIndex, parameterDefinition, localParameter);
                    } else if (localParameter.isRef) {
                        if (schemaFields?.length) {
                            paramContent = (
                                <Select
                                    t={t}
                                    options={schemaFields}
                                    label={`${t("auxSchema.form.reference")} ${parameterDefinition.name}`}
                                    value={localParameter.value ?? ""}
                                    onChangeHandler={(selectedValue) =>
                                        updateLocalParam(paramIndex, { value: selectedValue })
                                    }
                                    handlerClear={() => updateLocalParam(paramIndex, { value: undefined })}
                                    translateOptions={false}
                                />
                            );
                        } else {
                            paramContent = <p>{t("auxSchema.form.noFields")}</p>;
                        }
                    } else {
                        paramContent = renderParameterRef(param, paramIndex);
                    }

                    return (
                        <div
                            key={`${localFunction.function_name}-${parameterDefinition.name}-${paramIndex}`}
                            className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 p-2 border-t mt-2"
                        >
                            {parameterDefinition?.variadic ? (
                                <h2>{t("auxSchema.form.parameterVariadic", { name: parameterDefinition.name })}</h2>
                            ) : (
                                <InputCard>
                                    <div className="flex items-center justify-between border-input border p-2 rounded-md">
                                        <div className="flex flex-col">
                                            <label className="font-semibold">{`${t("auxSchema.form.inputType")} '${parameterDefinition.name}'`}</label>
                                            <div className="text-sm">
                                                {t(
                                                    localParameter.isRef
                                                        ? "auxSchema.form.reference"
                                                        : "auxSchema.form.value",
                                                )}
                                            </div>
                                        </div>
                                        {!parameterDefinition.variadic && (
                                            <Switch
                                                checked={!!localParameter.isRef}
                                                onCheckedChange={(next) =>
                                                    updateLocalParam(paramIndex, { isRef: next })
                                                }
                                            />
                                        )}
                                    </div>
                                </InputCard>
                            )}

                            <InputCard
                                className={`content-center ${parameterDefinition?.variadic ? "col-span-2" : ""}`}
                            >
                                {paramContent}
                            </InputCard>
                        </div>
                    );
                };
                return renderParamBlock();
            })}

            <InputCard>
                <h3 className="mb-2 font-medium">{t("auxSchema.form.errorPolicy", "Error policy")}</h3>
                <MultiSelect
                    type="button"
                    selectedData={(() => {
                        const val = values.fields[index]?.calc?.error_policy;
                        return val ? [{ id: val, value: val, label: val }] : [];
                    })()}
                    hiddenSelectedAll={true}
                    placeholder={selectedErrorPolicy ?? t("auxSchema.form.errorPolicy", "Error policy")}
                    options={ERROR_POLICY_OPTIONS}
                    onSelectOption={(selectedId) => setFieldValue(`${namePrefix}.calc.error_policy`, selectedId)}
                    single
                />
            </InputCard>

            <InputCard>
                <h3 className="mb-2 font-medium">{t("auxSchema.form.on", "On")}</h3>
                <MultiSelect
                    type="button"
                    selectedData={getTriggers().map((v) => ({ id: v, value: v, label: v }))}
                    placeholder={
                        getTriggers().length
                            ? getTriggers().join(", ")
                            : (selectedTrigger ?? t("auxSchema.form.on", "On"))
                    }
                    options={ON_OPTIONS}
                    onSelectOption={(selectedId) => {
                        const arr = getTriggers();
                        const next = arr.includes(selectedId)
                            ? arr.filter((id) => id !== selectedId)
                            : [...arr, selectedId];
                        setFieldValue(`${namePrefix}.calc.on`, next);
                    }}
                    onSelectedAll={() =>
                        setFieldValue(
                            `${namePrefix}.calc.on`,
                            ON_OPTIONS.map((o) => o.id),
                        )
                    }
                    showDeselectAll
                    onDeselectAll={() => setFieldValue(`${namePrefix}.calc.on`, [])}
                />
            </InputCard>
        </div>
    );
};

SchemasCalculatedField.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
};

export default SchemasCalculatedField;
