import { Switch, TabsContent } from "@kace/ui-shared";
import { SelectTypeData } from "./SelectTypeData";
import { AttachmentImportData } from "./AttachmentImportData";
import { TableFieldsComponent } from "./TableFieldsComponent";
import { CsvPreviewComponent } from "./CsvPreviewComponent";
import { useState } from "react";
import useExportData from "../hooks/useExportData";
import { useTranslation } from "react-i18next";

export const TabUploadFileComponent = () => {
    const { t } = useTranslation();
    const [moduleSelected, setModuleSelected] = useState(null);
    const [shouldOverrideArray, setShouldOverrideArray] = useState(false);
    const { tableName, currentHeaders } = useExportData({ module: moduleSelected, isImport: true });

    const handleModuleSelected = (module) => {
        setModuleSelected(module);
        setShouldOverrideArray(false);
    };

    return (
        <TabsContent value="uploadFile" id="tab_uploadFile_component" data-testid="tab_uploadFile_component">
            <SelectTypeData setModuleSelected={handleModuleSelected} isImport={true} />
            {moduleSelected && (
                <div className="flex w-full justify-center">
                    <div className="flex items-center gap-3 w-full max-w-md px-2 py-1">
                        <Switch
                            id="shouldOverrideArray"
                            checked={shouldOverrideArray}
                            onCheckedChange={setShouldOverrideArray}
                            data-testid="switch_should_override_array"
                        />
                        <label htmlFor="shouldOverrideArray" className="text-sm cursor-pointer">
                            {t("importExport.form.shouldOverrideArray")}
                        </label>
                    </div>
                </div>
            )}
            <div className="relative">
                {!moduleSelected && (
                    <div className="bg-gray-400 absolute top-0 right-0 w-full h-full flex items-center justify-center z-10 rounded-md opacity-50"></div>
                )}
                <AttachmentImportData
                    moduleSelected={moduleSelected}
                    tableName={tableName}
                    actionType="IMPORT"
                    shouldOverrideArray={shouldOverrideArray}
                />
            </div>
            {moduleSelected && (
                <>
                    <CsvPreviewComponent headers={currentHeaders} />
                    <TableFieldsComponent moduleSelected={moduleSelected} />
                </>
            )}
        </TabsContent>
    );
};
