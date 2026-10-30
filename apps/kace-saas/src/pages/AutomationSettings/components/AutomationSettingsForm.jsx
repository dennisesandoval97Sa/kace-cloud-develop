import { PropTypes } from "prop-types";
import { Formik, Form } from "formik";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, PlusIcon, XCircleIcon } from "lucide-react";
import FormCard from "../../../components/core/Cards/FormCard.jsx";
import InputCard from "../../../components/core/Cards/InputCard.jsx";
import SectionForm from "../../../components/core/Cards/section-form.jsx";
import {
    KField,
    InputForm as Input,
    SelectForm,
    Label,
    DatePickerWithRange,
    Toggle,
    Command,
    CommandList,
    CommandGroup,
    CommandItem,
} from "@kace/ui-shared";
import { cn } from "../../../components/ui-shared/src/lib/utils.js";
import { useTranslation } from "react-i18next";
import {
    AutomationSettingsCreateSchema,
    AutomationSettingsUpdateSchema,
} from "../../../schemas/AutomationSettingsSchema.js";
import { joiFormikAdapter } from "@kace/utils";
import { DAYS, FREQUENCY_OPTIONS } from "../data/constants.jsx";
import useCrontabString from "../hooks/useCrontabString.js";
import useSimpleCrontab from "../hooks/useSimpleCrontab.js";
import useScrollIntoViewOnce from "../hooks/useScrollIntoViewOnce.js";
import { formatTestId } from "@/utils/src/helpers.js";

const AutomationSettingsForm = ({ dataHandler, data = {}, isSending = false, mode = "create", isReadOnly = false }) => {
    const { t } = useTranslation();
    const isEditMode = mode === "edit";
    const buildCrontabString = useCrontabString();
    const simpleCrontab = useSimpleCrontab();
    const formRef = useRef();
    const [advancedFrequencyRef, requestAdvancedPositioning] = useScrollIntoViewOnce({ isDisabled: isReadOnly });
    const [formData, setFormData] = useState(null);
    const [isAdvancedCrontab, setIsAdvancedCrontab] = useState(false);
    const [selectedDays, setSelectedDays] = useState(Array(7).fill(true));
    const [isCustomFrequency, setIsCustomFrequency] = useState(false);

    const frequencyOptionsWithCustom = isCustomFrequency
        ? [...FREQUENCY_OPTIONS, { value: "custom", label: t("automationSettings.label.custom") }]
        : FREQUENCY_OPTIONS;

    const toggleDaySelected = (dayId) => {
        setSelectedDays((prev) => {
            const updated = prev.map((val, idx) => (idx + 1 === dayId ? !val : val));
            if (isCustomFrequency) {
                setIsCustomFrequency(false);
                formRef.current.setFieldValue("frequency_select", "every_hour");
                const newFrequency = buildCrontabString("every_hour", updated);
                formRef.current.setFieldValue("frequency", newFrequency);
            }
            return updated;
        });
    };

    const mapSelectedDays = (previous, selected) => previous.map((_, i) => selected.includes((i + 1).toString()));

    useEffect(() => {
        if (
            !isAdvancedCrontab &&
            !isCustomFrequency &&
            formRef.current?.values.frequency_select &&
            selectedDays.some((day) => day)
        ) {
            const newFrequency = buildCrontabString(formRef.current.values.frequency_select, selectedDays);
            if (newFrequency !== formRef.current.values.frequency) {
                formRef.current.setFieldValue("frequency", newFrequency);
            }
        }
    }, [selectedDays, isAdvancedCrontab, isCustomFrequency, formRef.current?.values.frequency_select]);

    useEffect(() => {
        if (
            isAdvancedCrontab &&
            formRef.current?.values.frequency_select &&
            selectedDays.some((day) => day) &&
            !isCustomFrequency
        ) {
            const advancedCrontabString = buildCrontabString(formRef.current.values.frequency_select, selectedDays);
            if (advancedCrontabString !== "* * * * *") {
                formRef.current.setFieldValue("frequency", advancedCrontabString);
            }
        }
    }, [isAdvancedCrontab, selectedDays, isCustomFrequency]);

    useEffect(() => {
        if (isEditMode && data?.frequency) {
            const [simpleFreq, simpleDays] = simpleCrontab(data.frequency) || [];

            if (simpleFreq === "custom") {
                setIsCustomFrequency(true);
                setIsAdvancedCrontab(true);
                requestAdvancedPositioning();
                setFormData({
                    ...data,
                    start_date: data.start_date ? new Date(data.start_date) : undefined,
                    end_date: data.end_date ? new Date(data.end_date) : undefined,
                    frequency_select: "custom",
                    frequency: data.frequency,
                });

                const updatedDays = mapSelectedDays(Array(7).fill(false), simpleDays.split(","));
                setSelectedDays(updatedDays);
            } else if (simpleFreq) {
                setIsCustomFrequency(false);
                setIsAdvancedCrontab(false);
                setFormData({
                    ...data,
                    start_date: data.start_date ? new Date(data.start_date) : undefined,
                    end_date: data.end_date ? new Date(data.end_date) : undefined,
                    frequency_select: simpleFreq.value,
                    frequency: data.frequency,
                });

                const updatedDays = mapSelectedDays(Array(7).fill(false), simpleDays.split(","));
                setSelectedDays(updatedDays);
            } else {
                setIsCustomFrequency(true);
                setIsAdvancedCrontab(true);
                requestAdvancedPositioning();
                setFormData({
                    ...data,
                    start_date: data.start_date ? new Date(data.start_date) : undefined,
                    end_date: data.end_date ? new Date(data.end_date) : undefined,
                    frequency_select: "custom",
                    frequency: data.frequency,
                });

                const parts = data.frequency.split(" ");
                if (parts.length === 5) {
                    const daysStr = parts[4];
                    const updatedDays = mapSelectedDays(
                        Array(7).fill(false),
                        daysStr.replace(/\*/g, "1,2,3,4,5,6,7").split(","),
                    );
                    setSelectedDays(updatedDays);
                }
            }
        } else {
            const defaultFrequency = buildCrontabString("every_hour", Array(7).fill(true));
            setFormData({
                ...data,
                start_date: data.start_date ? new Date(data.start_date) : new Date(),
                end_date: data.end_date ? new Date(data.end_date) : new Date(),
                frequency_select: "every_hour",
                frequency: defaultFrequency,
            });
            setSelectedDays(Array(7).fill(true));
        }
    }, [data, isEditMode, requestAdvancedPositioning]);

    const handleFrequencyChange = (value) => {
        const isLeavingCustom = isCustomFrequency && value !== "custom";

        formRef.current.setFieldValue("frequency_select", value);

        if (value === "custom") {
            setIsCustomFrequency(true);
        } else {
            if (isLeavingCustom) {
                setIsCustomFrequency(false);
            }

            const newFrequency = buildCrontabString(value, selectedDays);
            formRef.current.setFieldValue("frequency", newFrequency);
        }
    };

    const handleAdvancedToggle = (value) => {
        if (!value && formRef.current?.values.frequency) {
            const [simpleFreq, simpleDays] = simpleCrontab(formRef.current.values.frequency) || [];

            if (simpleFreq === "custom") {
                setIsCustomFrequency(true);
                formRef.current.setFieldValue("frequency_select", "custom");
                const updatedDays = mapSelectedDays(Array(7).fill(false), simpleDays.split(","));
                setSelectedDays(updatedDays);
            } else if (simpleFreq) {
                setIsCustomFrequency(false);
                formRef.current.setFieldValue("frequency_select", simpleFreq?.value);
                const updatedDays = mapSelectedDays(Array(7).fill(false), simpleDays.split(","));
                setSelectedDays(updatedDays);
            } else {
                setIsCustomFrequency(true);
            }
        }

        setIsAdvancedCrontab(value);
    };

    if (!formData?.frequency_select) return null;

    return (
        <Formik
            innerRef={formRef}
            enableReinitialize
            initialValues={formData}
            validationSchema={joiFormikAdapter(
                isEditMode ? AutomationSettingsUpdateSchema : AutomationSettingsCreateSchema,
            )}
            onSubmit={async (values, { setErrors, setStatus }) => {
                if (isReadOnly) return;

                const { frequency_select, ...sendValues } = values;
                if (!isAdvancedCrontab && !isCustomFrequency && !selectedDays.some((day) => day)) {
                    setErrors({ days: t("automationSettings.errors.requiredDays") });
                    return;
                }
                if (!isAdvancedCrontab && !isCustomFrequency && !values.frequency_select) {
                    setErrors({ frequency_select: t("automationSettings.errors.requiredFrequency") });
                    return;
                }
                if (!isAdvancedCrontab && !isCustomFrequency) {
                    sendValues.frequency = buildCrontabString(frequency_select, selectedDays);
                } else if (!isAdvancedCrontab && isCustomFrequency) {
                    sendValues.frequency = values.frequency;
                }
                dataHandler(sendValues, setErrors, setStatus);
            }}
        >
            {({ values, errors, status, setStatus, setFieldValue, setFieldTouched, touched, initialValues }) => {
                if (Object.entries(errors).length === 0 && status !== undefined) {
                    setStatus(undefined);
                }

                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={isEditMode} title={t("app.title.automationSettings")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <SectionForm
                                    title={t("Informacion servicio")}
                                    id="automation_settings_title"
                                    data-testid="automation_settings_title"
                                >
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="description"
                                                name="description"
                                                label={t("automationSettings.label.description")}
                                                type="text"
                                                placeholder={t("automationSettings.label.description")}
                                                className="flex flex-col items-start justify-start text-start"
                                                disabled={isReadOnly}
                                            />
                                        </KField>
                                    </InputCard>

                                    <InputCard>
                                        <DatePickerWithRange
                                            isTitle
                                            initialValues={[initialValues.start_date, initialValues.end_date]}
                                            value={
                                                values.start_date && values.end_date
                                                    ? `${values.start_date instanceof Date ? values.start_date.toISOString() : values.start_date}, ${values.end_date instanceof Date ? values.end_date.toISOString() : values.end_date}`
                                                    : undefined
                                            }
                                            nameFrom="start_date"
                                            nameTo="end_date"
                                            setValue={setFieldValue}
                                            errorFrom={!!errors.start_date}
                                            errorTo={!!errors.end_date}
                                            touchedFrom={!!touched.start_date}
                                            touchedTo={!!touched.end_date}
                                            disabled={isReadOnly}
                                        />
                                    </InputCard>

                                    <InputCard className="flex flex-row-reverse items-center">
                                        <Toggle
                                            id={`btn_automation_advanced_crontab_${!isAdvancedCrontab ? "plus_icon" : "clean_icon"}`}
                                            onPressedChange={handleAdvancedToggle}
                                            pressed={isAdvancedCrontab}
                                            disabled={isReadOnly}
                                            data-testid={`btn_automation_advanced_crontab_${!isAdvancedCrontab ? "plus_icon" : "clean_icon"}`}
                                        >
                                            {!isAdvancedCrontab ? <PlusIcon /> : <XCircleIcon />}
                                        </Toggle>
                                        <Label
                                            htmlFor="advancedCrontab"
                                            className="text-right text-sm mr-4"
                                            id="btn_atomation_advanced_label"
                                            data-testid="btn_atomation_advanced_label"
                                        >
                                            {t("automationSettings.label.advancedCrontab")}
                                        </Label>
                                    </InputCard>

                                    {isAdvancedCrontab && (
                                        <div ref={advancedFrequencyRef}>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        id="frequency"
                                                        name="frequency"
                                                        label={t("automationSettings.label.crontab")}
                                                        type="text"
                                                        placeholder={t("automationSettings.label.crontab")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                        onChange={(e) => setFieldValue("frequency", e.target.value)}
                                                        disabled={isReadOnly}
                                                    />
                                                </KField>
                                            </InputCard>
                                        </div>
                                    )}

                                    {!isAdvancedCrontab && (
                                        <>
                                            <InputCard>
                                                <div
                                                    className={`flex justify-between text-sm font-semibold ${errors.days && "text-redCustom"}`}
                                                >
                                                    <Label
                                                        className="text-sm"
                                                        id="atomation_days_label"
                                                        data-testid="atomation_days_label"
                                                    >
                                                        {t("automationSettings.label.executionDays")}
                                                    </Label>
                                                    {errors.days && (
                                                        <span
                                                            id="atomation_days_error"
                                                            data-testid="atomation_days_error"
                                                        >
                                                            {errors.days}
                                                        </span>
                                                    )}
                                                </div>
                                                <Command>
                                                    <CommandList>
                                                        <CommandGroup>
                                                            {DAYS.map((item) => (
                                                                <CommandItem
                                                                    data-testid={`atomation_item_select_days_${item.id}`}
                                                                    key={item.id}
                                                                    value={item.value}
                                                                    onSelect={() => {
                                                                        toggleDaySelected(item.id);
                                                                        setFieldTouched("execution_days", true);
                                                                    }}
                                                                    id={`atomation_item_select_days_${item.id}`}
                                                                    disabled={isReadOnly}
                                                                >
                                                                    <CheckIcon
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            selectedDays[item.id - 1]
                                                                                ? "opacity-100"
                                                                                : "opacity-0",
                                                                        )}
                                                                        id={`icon_atomation_days_${item.label}`}
                                                                        data-testid={`icon_atomation_days_${item.label}`}
                                                                    />
                                                                    {t(`app.days.${item.label}`)}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </InputCard>

                                            <InputCard>
                                                <KField>
                                                    <SelectForm
                                                        name="frequency_select"
                                                        label={t("automationSettings.label.frequency")}
                                                        placeholder={t("automationSettings.label.frequency")}
                                                        options={frequencyOptionsWithCustom}
                                                        handle={(value) => handleFrequencyChange(value)}
                                                        disabled={isReadOnly}
                                                    />
                                                </KField>
                                            </InputCard>

                                            {isCustomFrequency && values.frequency_select === "custom" && (
                                                <InputCard>
                                                    <div className="flex items-center gap-2">
                                                        <Label
                                                            className="text-sm font-semibold"
                                                            id="automation_custom_frequency_label"
                                                            data-testid="automation_custom_frequency_label"
                                                        >
                                                            {t("automationSettings.label.customFrequency")}:
                                                        </Label>
                                                        <span
                                                            className="text-sm font-mono bg-gray-100 px-2 py-1 rounded"
                                                            id={formatTestId(
                                                                "automation_settings",
                                                                `${values.frequency}`,
                                                            )}
                                                            data-testid={formatTestId(
                                                                "automation_settings",
                                                                `${values.frequency}`,
                                                            )}
                                                        >
                                                            {values.frequency || t("automationSettings.label.notSet")}
                                                        </span>
                                                    </div>
                                                </InputCard>
                                            )}
                                        </>
                                    )}
                                </SectionForm>
                            </div>
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};

AutomationSettingsForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
    mode: PropTypes.oneOf(["create", "edit"]),
    isReadOnly: PropTypes.bool,
};

export default AutomationSettingsForm;
