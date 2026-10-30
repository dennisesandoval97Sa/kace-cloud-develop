import { TabsContent } from "@kace/ui-shared";
import { SelectTypeData } from "./SelectTypeData";
import { AttachmentImportData } from "./AttachmentImportData";
import { CsvPreviewComponent } from "./CsvPreviewComponent";
import { useState } from "react";
import useExportData from "../hooks/useExportData";
import { useTranslation } from "react-i18next";

export const TabDeleteFileComponent = () => {
    const [moduleSelected, setModuleSelected] = useState(null);
    const { t } = useTranslation();
    const { tableName } = useExportData({ module: moduleSelected, isImport: true });

    const deleteHeaders = [
        {
            value: "id",
            nameColumn: "id",
            type: "uuid",
            label: "ID",
            required: true,
        },
    ];

    return (
        <TabsContent value="deleteData" id="tab_deleteFile_component" data-testid="tab_deleteFile_component">
            <SelectTypeData setModuleSelected={setModuleSelected} isImport={true} />
            <div className="relative">
                {!moduleSelected && (
                    <div className="bg-gray-400 absolute top-0 right-0 w-full h-full flex items-center justify-center z-10 rounded-md opacity-50"></div>
                )}
                <AttachmentImportData moduleSelected={moduleSelected} tableName={tableName} actionType="DELETE" />
            </div>
            {moduleSelected && (
                <div className="mt-4">
                    <div className="text-sm text-gray-600 bg-amber-50 p-3 rounded border border-amber-200 mb-4">
                        <p className="font-semibold mb-1">
                            ⚠️ {t("importExport.form.deleteWarning", "Precaución: Eliminación masiva")}
                        </p>
                        <p>
                            {t(
                                "importExport.form.deleteInstructions",
                                "Suba un archivo CSV que contenga únicamente la columna 'id' con los identificadores de los registros que desea eliminar. Si se incluyen otras columnas, los registros se actualizarán en lugar de eliminarse.",
                            )}
                        </p>
                    </div>
                    <CsvPreviewComponent headers={deleteHeaders} />
                </div>
            )}
        </TabsContent>
    );
};
