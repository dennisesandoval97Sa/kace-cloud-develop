import SelectList from "../select-list";
import { Input } from "../ui/input";
import { Controller } from "react-hook-form";
import { SwitchState } from "../SwitchState";
import { es } from "date-fns/locale";
import { DatePickerWithRange } from "../DatePickerWithRange";
import { SelectColors } from "../SelectColors";
import { SelectIcons } from "../SelectIcons";
import { ComboBoxForValue } from "../comboBoxForValue/ComboBoxForValue";
import { SelectByListLevels } from "../SelectByListLevels";
import { SPECIAL_FIELDS } from "../../../../../services/createSchemaFilter";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { SelectSingleSearch } from "@/components/core/SelectContainer/SelectSingleSearch";
import { processSchemaData } from "@/pages/OneScript/helpers/ProccesSelectSingle";

export function InputValueDepend(value = "", id = "", options = [], control, maxLevel) {
    if (SPECIAL_FIELDS.string === value) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => {
                    return (
                        <Input
                            {...field}
                            id={`input_${value}_depend_${id}`}
                            data-testid={`input_${value}_depend_${id}`}
                            className="col-span-3"
                        />
                    );
                }}
                data-testid={`input_string_depend_${id}`}
                id={`input_string_depend_${id}`}
            />
        );
    }
    if (SPECIAL_FIELDS.number === value) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => {
                    return (
                        <Input
                            {...field}
                            value={field.value ?? ""}
                            id={`input_${value}_depend_${id}`}
                            className="col-span-3"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            data-testid={`input_${value}_depend_${id}`}
                            onChange={(e) => {
                                field.onChange(e.target.value.replace(/\D/g, ""));
                            }}
                        />
                    );
                }}
                data-testid={`input_number_depend_${id}`}
                id={`input_number_depend_${id}`}
            />
        );
    }
    if (SPECIAL_FIELDS.date === value) {
        return (
            <Controller
                name={id}
                control={control}
                value={undefined}
                render={({ field }) => (
                    <DatePickerWithRange
                        {...field}
                        setValue={field.setValue}
                        id={`input_datepicker_${id}`}
                        locale={es}
                        noInitialDate={true}
                        data-testid={`input_datepicker_${id}`}
                    />
                )}
                data-testid={`input_date_depend_${id}`}
                id={`input_date_depend_${id}`}
            />
        );
    }
    if (SPECIAL_FIELDS.list === value) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => (
                    <SelectList
                        {...field}
                        label={`input_select_list_${id}`}
                        options={options}
                        data-testid={`input_select_list_${id}`}
                        id={`input_select_list_${id}`}
                    />
                )}
                data-testid={`input_list_depend_${id}`}
                id={`input_list_depend_${id}`}
            />
        );
    }
    if (SPECIAL_FIELDS.classification_levels === value) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => (
                    <SelectByListLevels
                        {...field}
                        label={id}
                        {...(maxLevel !== undefined && { maxLevel })}
                        data-testid={`input_classification_select_level_${id}`}
                        id={`input_classification_select_level_${id}`}
                    />
                )}
                data-testid={`input_classification_levels_depend_${id}`}
                id={`input_classification_levels_depend_${id}`}
            />
        );
    }
    if (SPECIAL_FIELDS.search_users === value) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => (
                    <ComboBoxForValue
                        {...field}
                        id={`input_search_box_users_${id}`}
                        className="col-span-3"
                        data-testid={`input_search_box_users_${id}`}
                    />
                )}
                data-testid={`input_search_users_depend_${id}`}
                id={`input_search_users_depend_${id}`}
            />
        );
    }
    if (SPECIAL_FIELDS.select_colors === value) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => {
                    return (
                        <SelectColors
                            {...field}
                            id={`input_select_colors_${id}`}
                            className="col-span-4"
                            data-tesid={`input_select_colors_${id}`}
                        />
                    );
                }}
                data-testid={`input_select_colors_depend_${id}`}
                id={`input_select_colors_depend_${id}`}
            />
        );
    }
    if (SPECIAL_FIELDS.select_icons === value) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => {
                    return (
                        <SelectIcons
                            {...field}
                            id={`input_select_icons_${id}`}
                            className="col-span-4"
                            data-testid={`input_select_icons_${id}`}
                        />
                    );
                }}
                data-testid={`input_select_icons_depend_${id}`}
                id={`input_select_icons_depend_${id}`}
            />
        );
    }
    if (SPECIAL_FIELDS.switch_state === value) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => (
                    <SwitchState {...field} id={`input_switch_state_${id}`} data-testid={`input_switch_state_${id}`} />
                )}
                data-testid={`input_switch_state_depend_${id}`}
                id={`input_switch_state_depend_${id}`}
            />
        );
    }
    if (SPECIAL_FIELDS.schema_id === value) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => {
                    return (
                        <SelectSingleSearch
                            {...field}
                            contentText="generalSetup.form.labels.searchForSchema"
                            placeholderText="generalSetup.form.labels.searchForSchema"
                            url={URL_AND_KEYS.schemas.url}
                            keyQuery={URL_AND_KEYS.schemas.key}
                            processData={processSchemaData}
                            setFieldValue={(_, value) => field.onChange(value)}
                        />
                    );
                }}
                data-testid={`input_switch_state_depend_${id}`}
                id={`input_switch_state_depend_${id}`}
            />
        );
    }
}
