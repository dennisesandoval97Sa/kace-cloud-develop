import MultiSelect from "@/componentsV2/core/MultiSelect";
import { FORMAT_FILES } from "@/utils/filesExtensions";
import { useFormikContext } from "formik";
import { useTranslation } from "react-i18next";
import { InputForm as Input, KField } from "@kace/ui-shared";
import { toast } from "sonner";
import Button from "@kace_v2/shared/ui/atoms/Button";

export const FilesSelect = () => {
    const { t } = useTranslation();
    const { values, setFieldValue, setFieldError } = useFormikContext();

    const options = FORMAT_FILES.flatMap((group) =>
        group.value.map((extension) => ({
            id: extension,
            value: extension,
            label: `${group.name} (${extension})`,
        })),
    );

    const currentValues = Array.isArray(values.allowed_file_extensions) ? values.allowed_file_extensions : [];

    const selectedData = options.filter((option) => currentValues.includes(option.value));

    const handleSelectOption = (selected) => {
        const selectedValue = typeof selected === "string" ? selected : selected?.value;

        if (!selectedValue) {
            return;
        }

        const isExists = currentValues.includes(selectedValue);
        const nextValues = isExists
            ? currentValues.filter((val) => val !== selectedValue)
            : [...currentValues, selectedValue];

        setFieldValue("allowed_file_extensions", nextValues);
    };

    const handleSelectAll = () => {
        const allValues = options.map((option) => option.value);
        setFieldValue("allowed_file_extensions", allValues);
    };

    const handleClearAll = () => {
        setFieldValue("allowed_file_extensions", []);
    };

    const handleInputChange = (event, message, fieldName) => {
        const rawValue = event.target.value;
        const value = Number(rawValue);

        if (value < 1) {
            toast.error(message);
            setFieldError(fieldName, message);
        } else {
            setFieldError(fieldName, undefined);
        }

        setFieldValue(fieldName, value);
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("generalSetup.form.labels.allowed_file_extensions")}</label>
            <MultiSelect
                selectedData={selectedData}
                options={options}
                onSelectOption={handleSelectOption}
                placeholder={t("select.searchPlaceholder")}
                single={false}
                onSelectedAll={handleSelectAll}
                showDeselectAll
                onDeselectAll={handleClearAll}
            />
            <Button onClick={handleClearAll} className="text-sm mt-1" disabled={currentValues.length === 0}>
                {t("app.forms.clearAll")}
            </Button>
            <KField>
                <Input
                    id="maximun_size_allowed"
                    name="maximun_size_allowed"
                    value={values.maximun_size_allowed || 1}
                    label={t("app.forms.maximunSizeFile")}
                    type="number"
                    min={1}
                    placeholder={t("app.forms.maximunSizeFile")}
                    className="flex flex-col items-start justify-start text-start w-full mt-3"
                    onChange={(event) => handleInputChange(event, t("app.forms.errorSizeFile"), "maximun_size_allowed")}
                />
            </KField>

            <KField>
                <Input
                    id="quantity_files_allowed"
                    name="quantity_files_allowed"
                    value={values.quantity_files_allowed || 1}
                    label={t("app.forms.quantityFiles")}
                    type="number"
                    min={1}
                    placeholder={t("app.forms.quantityFiles")}
                    className="flex flex-col items-start justify-start text-start w-full mt-3"
                    onChange={(event) =>
                        handleInputChange(event, t("app.forms.errorQuantityFiles"), "quantity_files_allowed")
                    }
                />
            </KField>
        </div>
    );
};
