import { useTranslation } from "react-i18next";
import { CheckBoxContainer } from "./CheckBoxContainer";
import PropTypes from "prop-types";
import useSchemaFields from "@/hooks/useSchemaFields";
import { useMemo, useCallback } from "react";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import { InputForm as Input } from "@kace/ui-shared";
import CasesViewColumnEditor from "./CasesViewColumnEditor";
import { blockNumericSignKeys, blockNumericSignPaste } from "../../helpers";

const InputsCasesContainer = ({ values, setFieldValue }) => {
    const { t } = useTranslation();
    const { schemaFields } = useSchemaFields();

    const viewOptions = useMemo(() => {
        if (!schemaFields) return [];
        return Object.keys(schemaFields)
            .filter((key) => key.startsWith("view_"))
            .map((key) => ({ value: key, label: key }));
    }, [schemaFields]);

    const setEnableAdminCustomView = useCallback(
        (name, checked) => {
            setFieldValue(name, checked);
            if (!checked) {
                setFieldValue("admin_custom_view_name", "");
                setFieldValue("admin_visible_columns", []);
            }
        },
        [setFieldValue],
    );

    return (
        <div className="px-2 flex w-full min-w-0 flex-col gap-2">
            <div className="grid md:grid-cols-2 grid-cols-1 gap-2">
                <div className="flex flex-col gap-2">
                    <div className="flex w-full justify-between items-center">
                        <Input
                            id="cases_admin_refresh_min"
                            name="cases_admin_refresh_min"
                            label={t("generalSetup.form.labels.cases_admin_refresh_min")}
                            type="number"
                            min="0"
                            placeholder={t("generalSetup.form.labels.value_min")}
                            className="flex flex-col items-start justify-start text-start"
                            value={values.cases_admin_refresh_min ?? "1"}
                            onChange={(e) => setFieldValue("cases_admin_refresh_min", e.target.value)}
                            onKeyDown={blockNumericSignKeys}
                            onPaste={blockNumericSignPaste}
                        />
                    </div>
                    <CheckBoxContainer
                        text={t("generalSetup.form.labels.enable_custom_view")}
                        value={values.enable_admin_custom_view}
                        setFieldValue={setEnableAdminCustomView}
                        name="enable_admin_custom_view"
                    />
                    {values?.enable_admin_custom_view && (
                        <SelectField
                            label={t("generalSetup.form.labels.select_custom_view")}
                            options={viewOptions}
                            value={values?.admin_custom_view_name || ""}
                            onValueChange={(value) => {
                                setFieldValue("admin_custom_view_name", value);
                            }}
                        />
                    )}
                </div>
            </div>
            {values?.enable_admin_custom_view && values?.admin_custom_view_name && (
                <CasesViewColumnEditor
                    viewName={values.admin_custom_view_name}
                    schemaFields={schemaFields}
                    value={values.admin_visible_columns ?? []}
                    onChange={(cols) => setFieldValue("admin_visible_columns", cols)}
                />
            )}
        </div>
    );
};

InputsCasesContainer.propTypes = {
    values: PropTypes.object,
    setFieldValue: PropTypes.func,
};

export default InputsCasesContainer;
