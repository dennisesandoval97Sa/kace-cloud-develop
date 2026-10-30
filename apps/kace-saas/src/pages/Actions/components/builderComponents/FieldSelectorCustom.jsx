import {
    ComboBox,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@kace/ui-shared";
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import useModelsData from "../../hooks/useModelsData";
import { useTranslation } from "react-i18next";
import { useFormikContext } from "formik";
import { ENTITIES_CATEGORY_OPTIONS } from "@/pages/Actions/data/constants";

const findDataOriginByValue = (valueToFind, opcionesBilder) => {
    const result = opcionesBilder.find((item) => item.options.some((option) => option.value === valueToFind));
    const option = result?.options.find((option) => option.value === valueToFind);
    return { type: result?.dataOrigin, value: option?.value, options: result?.options, selectedId: option?.id };
};

export const FieldSelectorCustom = ({ ...props }) => {
    const { t } = useTranslation();
    const { opcionesBuilder, loading } = useModelsData({});
    const { disabled = false } = props;
    const [menuOptions, setMenuOptions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [selectedIdValue, setSelectedIdValue] = useState(null);
    const [selectedListOptions, setSelectedListOptions] = useState(null);
    const configAdmin = useSelector((state) => state.generalSetup.configAdmin);
    const { values } = useFormikContext();

    const selectedEntity = useMemo(() => values?.entity, [values?.entity]);

    const parseOptionsBuilder = useMemo(() => {
        switch (selectedEntity) {
            case "user":
                return opcionesBuilder.filter(
                    (option) => option.dataOrigin === "usuarios" || option.dataOrigin === "aux_users",
                );
            case "group":
                return opcionesBuilder.filter(
                    (option) => option.dataOrigin === "grupos" || option.dataOrigin === "aux_groups",
                );
            default:
                return opcionesBuilder.filter(
                    (option) => option.dataOrigin !== "usuarios" || option.dataOrigin !== "grupos",
                );
        }
    }, [selectedEntity, opcionesBuilder]);

    useEffect(() => {
        if (!parseOptionsBuilder?.length) return;

        if (!selected) {
            const found = findDataOriginByValue(props.value, parseOptionsBuilder);
            let { type, value, options, selectedId } = found;
            if (value == null && props.value) {
                const legacyOption = { value: props.value, label: props.value, id: `legacy-${props.value}` };
                options = [legacyOption];
                value = legacyOption.value;
                selectedId = legacyOption.id;
            }
            setSelected(type);
            setSelectedListOptions(value);
            setMenuOptions(options);
            setSelectedIdValue(selectedId?.toString());
        } else {
            const valuesFilter = parseOptionsBuilder.find((item) => item.dataOrigin === selected);
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
    }, [selected, parseOptionsBuilder, setSelected, setSelectedListOptions, setMenuOptions]);

    useEffect(() => {
        if (selectedEntity) {
            setSelected("");
            setSelectedListOptions("");
            setSelectedIdValue("");
        }
    }, [selectedEntity]);

    return (
        <div className="my-2 ml-2 flex flex-col gap-4 lg:flex-row lg:gap-2 w-full min-w-0">
            <div className="flex-1 min-w-0">
                <Select
                    onValueChange={(value) => setSelected(value)}
                    value={selected}
                    data-testid="select_category_type"
                    id="select_category_type"
                    disabled={disabled}
                >
                    <SelectTrigger
                        className="flex gap-2 rounded w-full"
                        data-testid="select_trigger_category_type"
                        id="select_trigger_category_type"
                    >
                        <SelectValue
                            placeholder={t("actions.placeholder.categories")}
                            data-testid="select_value_category_type"
                            id="select_value_category_type"
                        />
                    </SelectTrigger>
                    <SelectContent id="select_content_category_type" data-testid="select_content_category_type">
                        <SelectGroup id="select_group_category_type" data-testid="select_group_category_type">
                            <SelectLabel id="select_label_category_type" data-testid="select_label_category_type">
                                {t("actions.form.options")}
                            </SelectLabel>
                            {values?.entity &&
                                ENTITIES_CATEGORY_OPTIONS[values.entity].map((option) => (
                                    <SelectItem
                                        key={option.id}
                                        value={option.value}
                                        data-testid={option.id}
                                        id={option.id}
                                    >
                                        {t(option.label)}
                                    </SelectItem>
                                ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex-1 min-w-0">
                <ComboBox
                    placeholder={t("actions.placeholder.options")}
                    data={menuOptions}
                    className="w-full"
                    handleOnChange={props.handleOnChange}
                    dataTestId={props.testID}
                    defaultValue={selectedListOptions}
                    classNamePopover="md:w-[calc(100vw-20rem)] lg:w-[calc(70vw-20rem)]"
                    disabled={loading || disabled}
                    defaultId={selectedIdValue}
                    showClearButton={false}
                />
            </div>
        </div>
    );
};

FieldSelectorCustom.propTypes = {
    handleOnChange: PropTypes.func.isRequired,
    testID: PropTypes.string,
    value: PropTypes.string,
    disabled: PropTypes.bool,
};
