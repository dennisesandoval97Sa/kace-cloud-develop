import { TabsContent } from "@kace/ui-shared"
import { SelectTypeData } from "./SelectTypeData"
import { AttachmentImportData } from "./AttachmentImportData"
import { TableFieldsComponent } from "./TableFieldsComponent"
import { useState } from "react"

export const TabUploadFileComponent = () => {
    const [moduleSelected, setModuleSelected] = useState("usuarios")
    return (
        <TabsContent value="uploadFile" id="tab_uploadFile_component" data-testid="tab_uploadFile_component">
            <SelectTypeData setModuleSelected={setModuleSelected} isImport={true} />
            <div className="relative">
                {!moduleSelected && (
                    <div className="bg-gray-400 absolute top-0 right-0 w-full h-full flex items-center justify-center z-10 rounded-md opacity-50"></div>
                )}
                <AttachmentImportData moduleSelected={moduleSelected} />
            </div>
            <TableFieldsComponent moduleSelected={moduleSelected} />
        </TabsContent>
    );
}
