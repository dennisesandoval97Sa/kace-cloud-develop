import { ToggleGroup, ToggleGroupItem } from "@kace/ui-shared";
import { Users } from "lucide-react";
import { MODULES } from "../data/Constants";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

export const SelectTypeData = ({ setModuleSelected, isImport = false }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-4 items-center">
            <h2 className="text-lg font-semibold">
                {t(isImport ? "importExport.form.modulesToImport" : "importExport.form.modulesToExport")}
            </h2>

            <ToggleGroup
                type="single"
                value={MODULES.usuarios.value}
                onValueChange={(value) => setModuleSelected(value)}
                className="flex flex-wrap gap-2"
                id="select_type_module"
                data-testid="select_type_module"
            >
                <ToggleGroupItem
                    value={MODULES.usuarios.value}
                    className={"data-[state=on]:bg-greenCustom/50 data-[state=on]:text-greenCustom data-[state=on]:text-lg flex gap-2 hover:bg-grayCustom border border-input min-w-32"}
                    disabled={true}
                    id="bnt_select_type_modules_users"
                    data-testid="bnt_select_type_modules_users"
                >
                    <Users /> {t("modulesNames.users")}
                </ToggleGroupItem>
            </ToggleGroup>
        </div>
    );
};

SelectTypeData.propTypes = {
    setModuleSelected: PropTypes.func.isRequired,
    isImport: PropTypes.bool,
};
