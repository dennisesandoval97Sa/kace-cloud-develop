import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";

import { InputForm as Input, KField } from "@kace/ui-shared";
import { useFormikContext } from "formik";
import { useEffect, useMemo, useState } from "react";
import SchemasRestFlowField from "./SchemasRestFlowField";
import SchemasRegexReplace from "./SchemasRegexReplace";
import SchemasPatternFlagsInput from "./SchemasPatternFlagsInput";
import InputCard from "@/components/core/Cards/InputCard";
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";
import { Label } from "@/components/ui-shared";
import { SelectField } from "@/components/core/SearchClient/SelectField";
import { getSchemasStringDataTypeOptions, getIpCidrOptions } from "../data/constants";

const SchemasStringField = ({ namePrefix, index }) => {
    const { t } = useTranslation();
    const { values, setFieldValue, setFieldError, setFieldTouched } = useFormikContext();

    const field = useMemo(() => values.fields[index], [values]);
    const hasValidation = useMemo(() => field?.validationType !== "-", [field?.validationType]);
    const isEmail = useMemo(() => field?.validationType === "email", [field?.validationType]);
    const isIp = useMemo(() => field?.validationType === "ip", [field?.validationType]);
    const isPattern = useMemo(() => field?.validationType === "pattern", [field?.validationType]);
    const isUri = useMemo(() => field?.validationType === "uri", [field?.validationType]);
    // `transform` es estado de formulario (Formik); nunca se lee desde data_structure persistido (ver validateString).
    const isTransform = useMemo(() => field?.transform, [field?.transform]);

    const schemasStringDataTypeOptions = useMemo(() => getSchemasStringDataTypeOptions(t), [t]);
    const ipCidrOptions = useMemo(() => getIpCidrOptions(t), [t]);
    const [localTlds, setLocalTlds] = useState("");
    const [tldsDirty, setTldsDirty] = useState(false);

    useEffect(() => {
        if (field.transform) {
            setFieldValue(`${namePrefix}.lowercase`, !field.uppercase);
        }
    }, [field]);

    useEffect(() => {
        if (!field) return;

        const current = field.validationType;
        const missing = current === null || current === undefined || current === "";
        if (!missing) return;

        const infer = () => {
            const tldsAllow = field.email && field.email.tlds && field.email.tlds.allow;
            const tldsHasValue = Array.isArray(tldsAllow)
                ? tldsAllow.length > 0
                : typeof tldsAllow === "string" && tldsAllow.trim().length > 0;
            if (field.email && (tldsHasValue || (field.email && field.email.minDomainSegments))) return "email";
            if (field.ip || field.IPv4 || field.IPv6) return "ip";
            if (field.uri && (field.uri.scheme || field.uri.allowRelative !== undefined)) return "uri";
            if (field.pattern && field.pattern.regex) return "pattern";
            return "-";
        };

        const inferred = infer();
        if (inferred && inferred !== current) {
            setFieldValue(`${namePrefix}.validationType`, inferred);
        }
    }, [field, namePrefix, setFieldValue]);

    useEffect(() => {
        if (!field) return;
        const tlds = field.email && field.email.tlds && field.email.tlds.allow;
        if (tlds === undefined || tlds === null) return;

        const joined = Array.isArray(tlds) ? tlds.join(", ") : String(tlds);
        if (!tldsDirty) {
            setLocalTlds(joined);
        }
    }, [field?.email?.tlds, tldsDirty]);

    useEffect(() => {
        if (!field) return;
        const ipObj = field.ip;
        if (!ipObj) return;

        const version = Array.isArray(ipObj.version) ? ipObj.version : [];
        const hasIpv4 = version.includes("ipv4");
        const hasIpv6 = version.includes("ipv6");
        const cidr = ipObj.cidr ?? "optional";

        if (field.IPv4 !== hasIpv4) setFieldValue(`${namePrefix}.IPv4`, hasIpv4);
        if (field.IPv6 !== hasIpv6) setFieldValue(`${namePrefix}.IPv6`, hasIpv6);
        if ((field.ip && field.ip.cidr) !== cidr) setFieldValue(`${namePrefix}.ip.cidr`, cidr);
    }, [field?.ip, namePrefix, setFieldValue]);

    useEffect(() => {
        if (!field) return;
        const patternObj = field.pattern;
        if (!patternObj) return;

        const currentRegex = values.fields?.[index]?.pattern?.regex;
        const currentFlags = values.fields?.[index]?.pattern?.flags;
        const sourceRegex = patternObj.regex;
        const sourceFlags = patternObj.flags;

        if (field.validationType !== "pattern" && sourceRegex) {
            setFieldValue(`${namePrefix}.validationType`, "pattern");
        }

        if (sourceRegex && (currentRegex === undefined || currentRegex === "")) {
            setFieldValue(`${namePrefix}.pattern.regex`, sourceRegex);
        }

        if (sourceFlags !== undefined && sourceFlags !== null && (currentFlags === undefined || currentFlags === "")) {
            setFieldValue(`${namePrefix}.pattern.flags`, sourceFlags);
        }
    }, [field?.pattern, field?.validationType, namePrefix, setFieldValue, values.fields, index]);

    useEffect(() => {
        const validationType = field?.validationType;
        const base = namePrefix;
        const clear = (path) => {
            setFieldValue(path, undefined);
            if (typeof setFieldError === "function") setFieldError(path, undefined);
            if (typeof setFieldTouched === "function") setFieldTouched(path, false);
        };

        const mapping = {
            pattern: [`${base}.pattern.regex`, `${base}.pattern.flags`],
            email: [`${base}.email.minDomainSegments`, `${base}.email.tlds.allow`],
            ip: [`${base}.ip.cidr`, `${base}.IPv4`, `${base}.IPv6`],
            uri: [`${base}.uri.scheme`, `${base}.uri.allowRelative`],
        };

        Object.keys(mapping).forEach((type) => {
            if (type !== validationType) {
                // Don't clear pattern if it has existing data (to preserve values during initial load)
                if (type === "pattern" && field?.pattern?.regex) {
                    return;
                }
                mapping[type].forEach((p) => clear(p));
            }
        });
    }, [field?.validationType, field?.pattern, namePrefix, setFieldValue, setFieldError, setFieldTouched]);

    const handleCidrChanged = (cidr) => {
        setFieldValue(`${namePrefix}.ip.cidr`, cidr);
    };

    return (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 border-l-4 border-gray-200 items-center">
            <InputCard>
                <KField>
                    <Input
                        name={`${namePrefix}.default`}
                        label={t("auxSchema.form.default")}
                        type="text"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </InputCard>
            <div></div>
            <InputCard>
                <SwitchStateAdmin
                    name={`${namePrefix}.isFixedLength`}
                    title={t("auxSchema.form.fixedLength")}
                    tipo="boolean"
                />
            </InputCard>
            {field.isFixedLength && (
                <InputCard>
                    <KField>
                        <Input
                            name={`${namePrefix}.length`}
                            label={t("auxSchema.form.length")}
                            type="number"
                            className="flex flex-col items-start justify-start text-start"
                            min={1}
                        />
                    </KField>
                </InputCard>
            )}
            {!field.isFixedLength && (
                <div className="grid grid-cols-1 gap-2">
                    <InputCard>
                        <KField>
                            <Input
                                name={`${namePrefix}.min`}
                                label={t("auxSchema.form.minLength")}
                                type="number"
                                className="flex flex-col items-start justify-start text-start"
                            />
                        </KField>
                    </InputCard>
                    <InputCard>
                        <KField>
                            <Input
                                name={`${namePrefix}.max`}
                                label={t("auxSchema.form.maxLength")}
                                type="number"
                                className="flex flex-col items-start justify-start text-start"
                            />
                        </KField>
                    </InputCard>
                </div>
            )}

            <div
                className={`col-span-2 grid-cols-3 grid ${hasValidation ? "gap-2 border-input border p-2 rounded-md" : ""}`}
            >
                <InputCard className="col-span-3">
                    <div className="flex items-center mb-2">
                        <Label htmlFor={`field-${index}-string-validation-type`} className="flex justify-end">
                            {t("auxSchema.form.validationType")}
                        </Label>
                    </div>
                    <SelectField
                        id={`field-${index}-string-validation-type`}
                        options={schemasStringDataTypeOptions}
                        name={`${namePrefix}.validationType`}
                    />
                </InputCard>

                {isPattern && (
                    <>
                        <InputCard className="col-span-2">
                            <KField>
                                <Input
                                    name={`${namePrefix}.pattern.regex`}
                                    label={t("auxSchema.form.pattern")}
                                    type="text"
                                    placeholder="e.g., ^[a-z]+$"
                                    className="flex flex-col items-start justify-start text-start"
                                />
                            </KField>
                        </InputCard>
                        <InputCard>
                            <SchemasPatternFlagsInput namePrefix={namePrefix} />
                        </InputCard>
                    </>
                )}

                {isEmail && (
                    <>
                        <InputCard>
                            <KField>
                                <Input
                                    name={`${namePrefix}.email.minDomainSegments`}
                                    label={t("auxSchema.form.minDomainSegments")}
                                    type="number"
                                    min={1}
                                    className="flex flex-col items-start justify-start text-start"
                                />
                            </KField>
                        </InputCard>
                        <InputCard className="col-span-2">
                            <Input
                                name={`${namePrefix}.email.tlds.allow`}
                                label={t("auxSchema.form.tlds")}
                                type="string"
                                placeholder="com, co, mx..."
                                className="flex flex-col items-start justify-start text-start"
                                value={localTlds}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setLocalTlds(v);
                                    setTldsDirty(true);
                                    setFieldValue(`${namePrefix}.email.tlds.allow`, v);
                                }}
                            />
                        </InputCard>
                    </>
                )}

                {isIp && (
                    <>
                        <InputCard>
                            <div className="flex items-center mb-2">
                                <Label htmlFor={`field-${index}-string-ip-cidr`} className="flex justify-end">
                                    {t("auxSchema.form.cidr")}
                                </Label>
                            </div>
                            <SelectField
                                id={`field-${index}-string-ip-cidr`}
                                label={t("auxSchema.form.cidr")}
                                options={ipCidrOptions}
                                name={`fields[${index}].ip.cidr`}
                                handle={handleCidrChanged}
                            />
                        </InputCard>
                        <InputCard className="mr-2">
                            <SwitchStateAdmin name={`${namePrefix}.IPv4`} title={"IPv4"} tipo="boolean" />
                        </InputCard>
                        <InputCard>
                            <SwitchStateAdmin name={`${namePrefix}.IPv6`} title={"IPv6"} tipo="boolean" />
                        </InputCard>
                    </>
                )}

                {isUri && (
                    <>
                        <InputCard className="col-span-2">
                            <KField>
                                <Input
                                    name={`${namePrefix}.uri.scheme`}
                                    label={t("auxSchema.form.scheme")}
                                    type="string"
                                    placeholder="http, https"
                                    className="flex flex-col items-start justify-start text-start"
                                />
                            </KField>
                        </InputCard>
                        <InputCard className="mr-2">
                            <SwitchStateAdmin
                                name={`${namePrefix}.uri.allowRelative`}
                                title={t("auxSchema.form.allowRelative")}
                                tipo="boolean"
                            />
                        </InputCard>
                    </>
                )}
            </div>

            <SchemasRegexReplace namePrefix={namePrefix} index={index} />

            <InputCard>
                <SwitchStateAdmin name={`${namePrefix}.trim`} title={t("auxSchema.form.trim")} tipo="boolean" />
            </InputCard>

            <InputCard>
                <SwitchStateAdmin name={`${namePrefix}.alphanum`} title={t("auxSchema.form.alphanum")} tipo="boolean" />
            </InputCard>

            <InputCard>
                <SwitchStateAdmin
                    name={`${namePrefix}.transform`}
                    title={t("auxSchema.form.transform")}
                    tipo="boolean"
                />
            </InputCard>

            {isTransform && (
                <InputCard>
                    <SwitchStateAdmin
                        name={`${namePrefix}.uppercase`}
                        title={t("auxSchema.form.case")}
                        tipo="boolean"
                        trueText={t("auxSchema.form.uppercase")}
                        falseText={t("auxSchema.form.lowercase")}
                    />
                </InputCard>
            )}
            {!isTransform && <div></div>}

            <InputCard>
                <KField>
                    <Input
                        name={`${namePrefix}.valid`}
                        label={t("auxSchema.form.whitelist")}
                        type="text"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </InputCard>

            <InputCard>
                <KField>
                    <Input
                        name={`${namePrefix}.invalid`}
                        label={t("auxSchema.form.blacklist")}
                        type="text"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </InputCard>

            <SchemasRestFlowField index={index} namePrefix={namePrefix} />
        </div>
    );
};

SchemasStringField.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
};

export default SchemasStringField;
