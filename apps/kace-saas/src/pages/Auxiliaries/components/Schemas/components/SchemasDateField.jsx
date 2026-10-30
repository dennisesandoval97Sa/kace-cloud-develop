import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { InputForm as Input } from "@kace/ui-shared";
import SchemasRestFlowField from "./SchemasRestFlowField";
import { useField, useFormikContext } from "formik";
import InputCard from "@/components/core/Cards/InputCard";
import { DatePicker, Label } from "@/components/ui-shared";
import { SelectField } from "@/components/core/SearchClient/SelectField";
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";
import { SUPPORTED_TIMEZONES } from "@/constants/timezones";
import { TIMEZONE } from "@/utils/URL";

const SchemasDateField = ({ namePrefix, index }) => {
    const { t } = useTranslation();
    const { values, errors, touched, setFieldValue } = useFormikContext();
    const [isoField] = useField(`${namePrefix}.iso`);
    const [timezoneFormatField] = useField(`${namePrefix}.timezoneFormat`);

    const dateFormatOptions = [
        { value: "javascript", label: t("auxSchema.form.javascript") },
        { value: "unix", label: t("auxSchema.form.unix") },
    ];

    const timezoneFormatOptions = [
        { value: "withTimezone", label: t("auxSchema.form.withTimezone") },
        { value: "withoutTimezone", label: t("auxSchema.form.withoutTimezone") },
    ];

    const timezoneOptions = SUPPORTED_TIMEZONES.map((tz) => ({ value: tz, label: tz }));

    useEffect(() => {
        if (
            isoField.value &&
            timezoneFormatField.value === "withoutTimezone" &&
            (!values?.fields?.[index]?.timezone || values?.fields?.[index]?.timezone === "") &&
            TIMEZONE &&
            SUPPORTED_TIMEZONES.includes(TIMEZONE)
        ) {
            setFieldValue(`${namePrefix}.timezone`, TIMEZONE);
        }
    }, [
        isoField.value,
        timezoneFormatField.value,
        namePrefix,
        index,
        values?.fields?.[index]?.timezone,
        setFieldValue,
    ]);

    return (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 border-l-4 border-gray-200 items-center">
            <InputCard>
                <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <Label htmlFor={`field-${index}-timestamp`} className="flex justify-end">
                            {t("auxSchema.form.timestampType")}
                        </Label>
                        {touched?.fields?.[index]?.timestamp && errors?.fields?.[index]?.timestamp && (
                            <p className="text-sm text-redCustom">{errors.fields[index].timestamp}</p>
                        )}
                    </div>
                    <SelectField
                        id={`field-${index}-timestamp`}
                        label={t("auxSchema.form.timestampType")}
                        options={dateFormatOptions}
                        name={`${namePrefix}.timestamp`}
                        disabled={Boolean(isoField.value)}
                    />
                </div>
            </InputCard>
            <InputCard>
                <SwitchStateAdmin
                    name={`${namePrefix}.iso`}
                    title={t("auxSchema.form.iso")}
                    tipo="boolean"
                    trueText={t("auxSchema.form.true")}
                    falseText={t("auxSchema.form.false")}
                />
            </InputCard>
            {isoField.value && (
                <>
                    <InputCard>
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <Label htmlFor={`field-${index}-timezone-format`} className="flex justify-end">
                                    {t("auxSchema.form.dateFormatLabel")}
                                </Label>
                                {touched?.fields?.[index]?.timezoneFormat &&
                                    errors?.fields?.[index]?.timezoneFormat && (
                                        <p className="text-sm text-redCustom">{errors.fields[index].timezoneFormat}</p>
                                    )}
                            </div>
                            <SelectField
                                id={`field-${index}-timezone-format`}
                                label={t("auxSchema.form.dateFormatLabel")}
                                options={timezoneFormatOptions}
                                name={`${namePrefix}.timezoneFormat`}
                            />
                        </div>
                    </InputCard>
                    {timezoneFormatField.value === "withoutTimezone" && (
                        <InputCard>
                            <div className="flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <Label htmlFor={`field-${index}-timezone`} className="flex justify-end">
                                        {t("auxSchema.form.timezone")}
                                    </Label>
                                    {errors?.fields?.[index]?.timezone && (
                                        <p className="text-sm text-redCustom">{errors.fields[index].timezone}</p>
                                    )}
                                </div>
                                <SelectField
                                    id={`field-${index}-timezone`}
                                    label={t("auxSchema.form.timezone")}
                                    options={timezoneOptions}
                                    name={`${namePrefix}.timezone`}
                                />
                            </div>
                        </InputCard>
                    )}
                </>
            )}
            <InputCard>
                <SwitchStateAdmin
                    name={`${namePrefix}.empty`}
                    title={t("auxSchema.form.empty")}
                    tipo="boolean"
                    trueText={t("auxSchema.form.true")}
                    falseText={t("auxSchema.form.false")}
                />
            </InputCard>
            <InputCard>
                <DatePicker
                    value={values?.fields?.[index]?.default}
                    placeholder={t("auxSchema.form.defaultDate")}
                    label={t("auxSchema.form.defaultDate")}
                    onChange={(values) => setFieldValue(`${namePrefix}.default`, values)}
                    error={errors?.fields?.[index]?.default}
                    errorMessage={errors?.fields?.[index]?.default ?? ""}
                    showTimeSelect={false}
                    dateFormat="Pp"
                    customInput={<Input className="cursor-pointer" name={`${namePrefix}.default`} />}
                    name={`${namePrefix}.default`}
                    nowButton
                />
            </InputCard>
            <InputCard>
                <DatePicker
                    value={values?.fields?.[index]?.min}
                    placeholder={t("auxSchema.form.minDate")}
                    label={t("auxSchema.form.minDate")}
                    onChange={(values) => setFieldValue(`${namePrefix}.min`, values)}
                    error={errors?.fields?.[index]?.min}
                    errorMessage={errors?.fields?.[index]?.min ?? ""}
                    showTimeSelect={false}
                    dateFormat="Pp"
                    customInput={<Input className="cursor-pointer" name={`${namePrefix}.minDate`} />}
                    name={`${namePrefix}.minDate`}
                    nowButton
                />
            </InputCard>
            <InputCard>
                <DatePicker
                    value={values?.fields?.[index]?.max}
                    placeholder={t("auxSchema.form.maxDate")}
                    label={t("auxSchema.form.maxDate")}
                    onChange={(values) => setFieldValue(`${namePrefix}.max`, values)}
                    error={errors?.fields?.[index]?.max}
                    errorMessage={errors?.fields?.[index]?.max ?? ""}
                    showTimeSelect={false}
                    dateFormat="Pp"
                    customInput={<Input className="cursor-pointer" name={`${namePrefix}.maxDate`} />}
                    name={`${namePrefix}.maxDate`}
                    nowButton
                />
            </InputCard>

            <SchemasRestFlowField index={index} namePrefix={namePrefix} />
        </div>
    );
};

SchemasDateField.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
};

export default SchemasDateField;
