import { Label } from "@kace/ui-shared";
import InputCard from "../../../components/core/Cards/InputCard";
import PropTypes from "prop-types";
import { agregateOptions, allowedKeysData } from "../data/constants";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SelectContainer } from "@/components/core/SelectContainer/SelectContainer";
import useModelsData from "@/pages/Actions/hooks/useModelsData";
import { ComboBox } from "@/components/ui-shared";
import { useSelector } from "react-redux";

const findDataOriginByValue = (valueToFind, opcionesBilder) => {
    const result = opcionesBilder.find((item) => item.options.some((option) => option.value === valueToFind));
    const option = result?.options.find((option) => option.value === valueToFind);
    return { type: result?.dataOrigin, value: option?.value, options: result?.options, selectedId: option?.id };
};

export const ModelFieldSelector = ({
    values = {},
    errors = {},
    touched = {},
    setFieldValue = () => {},
    aggregateKey = "",
    fieldKey = "",
}) => {
    const { t } = useTranslation();
    const { opcionesBuilder, loading } = useModelsData({
        includeModel: false,
        allowedKeys: allowedKeysData,
        includeStatus: false,
    });

    const [menuOptions, setMenuOptions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [selectedIdValue, setSelectedIdValue] = useState(null);
    const [selectedListOptions, setSelectedListOptions] = useState(null);
    const configAdmin = useSelector((state) => state.generalSetup.configAdmin);

    useEffect(() => {
        if (!selected && values) {
            const savedValue = values[fieldKey];
            const found = findDataOriginByValue(savedValue, opcionesBuilder);
            let { type, value, options, selectedId } = found;
            if (value == null && savedValue) {
                const legacyOption = { value: savedValue, label: savedValue, id: `legacy-${savedValue}` };
                options = [legacyOption];
                value = legacyOption.value;
                selectedId = legacyOption.id;
            }
            setSelected(type);
            setSelectedListOptions(value);
            setMenuOptions(options);
            setSelectedIdValue(selectedId);
        } else {
            const valuesFilter = opcionesBuilder.find((item) => item.dataOrigin === selected);
            let options = valuesFilter?.options;

            if (selected === "classification" && options) {
                options = options.map((level) => ({
                    ...level,
                    label: configAdmin?.classifications[`label_${level.id}`] ?? level.label,
                }));
            }

            if (selected === "clients" && options) {
                options = options.map((item) => ({
                    ...item,
                    label: configAdmin?.clients[`${item.value}`] ?? item.label,
                }));
            }

            setMenuOptions(options ?? []);
        }
    }, [values, selected, opcionesBuilder, setSelected, setSelectedListOptions, setMenuOptions]);

    useEffect(() => {
        if (aggregateKey === "aggregate_aux" && fieldKey === "field_aux") {
            const value = values?.value ?? "";
            const [aggregate_aux = "", field_aux = ""] = value.split(/\.(.+)/);
            setFieldValue(aggregateKey, aggregate_aux);
            setFieldValue(fieldKey, field_aux);
        }
    }, [aggregateKey, fieldKey, setFieldValue]);

    return (
        <>
            <div className="grid grid-cols-4 gap-4 items-center">
                <Label className={`${errors.aggregate && touched.aggregate && "text-redCustom"} text-right`}>
                    {t("gridMain.columns.Model")}
                </Label>
                <InputCard className="col-start-2 col-end-5">
                    <SelectContainer
                        name={aggregateKey}
                        options={agregateOptions}
                        value={values[aggregateKey]}
                        setFieldValue={(_, label) => {
                            setFieldValue(aggregateKey, label);
                            setSelected(
                                agregateOptions.find((agregate) => agregate.value === label)?.dataOrigin ?? null,
                            );
                        }}
                        error={errors[aggregateKey]}
                        touched={touched[aggregateKey]}
                    />
                </InputCard>
            </div>

            <div className="grid grid-cols-4 gap-4 items-center">
                <Label className={`${errors?.[fieldKey] && touched?.[fieldKey] && "text-redCustom"} text-right`}>
                    {t("app.text.field")}
                </Label>
                <InputCard className="col-start-2 col-end-5">
                    <ComboBox
                        placeholder={t("actions.placeholder.options")}
                        className="flex gap-2 rounded-s-none w-full"
                        classNamePopover="md:w-full"
                        disabled={loading}
                        data={menuOptions}
                        handleOnChange={(value) => setFieldValue(fieldKey, value)}
                        defaultValue={selectedListOptions}
                        defaultId={selectedIdValue}
                    />
                </InputCard>
            </div>
        </>
    );
};

ModelFieldSelector.propTypes = {
    values: PropTypes.object,
    errors: PropTypes.object,
    touched: PropTypes.object,
    setFieldValue: PropTypes.func,
    aggregateKey: PropTypes.string,
    fieldKey: PropTypes.string,
};
