import { DownloadIcon, File, ImageOff, Loader2, X } from "lucide-react"
import PropTypes from "prop-types"
import React, { useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { Button, ScrollArea } from "../../../components/ui-shared"
import { getAllowedExtensions, processFiles } from "../../../utils/fileProcessor"
import { formatTestId } from "@/utils/src/helpers"

export const HelpsAttachment = ({
    handleFiles,
    listAttachment = [],
    getAttachment,
    deleteAttachment,
    isPendingDelete = false
}) => {
    const [isDragActive, setIsDragActive] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const fileInputRef = useRef(null)
    const localPath = useLocation()

    const allowedCategories = ["csv", "images", "txt"]

    const allowedExtensions = getAllowedExtensions(allowedCategories)

    const allowedExtensionsString = allowedExtensions.join(", ")

    const handleDragOver = (event) => {
        event.preventDefault()
        setIsDragActive(true)
    }

    const handleDragLeave = (event) => {
        event.preventDefault()
        setIsDragActive(false)
    }

    const handleDrop = (event) => {
        event.preventDefault()
        setIsDragActive(false)
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            processFiles(
                event.dataTransfer.files,
                null,
                handleFiles,
                () => setIsValidating(true),
                () => setIsValidating(false)
            )
        }
    }

    const handleFileChange = (event) => {
        if (event.target.files && event.target.files.length > 0) {
            processFiles(
                event.target.files,
                null,
                handleFiles,
                () => setIsValidating(true),
                () => setIsValidating(false)
            )
        }
    }

    return (
        <div className="p-4 m-2">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative p-6 text-center border-2 border-dashed rounded-lg ${isDragActive ? "border-primary" : "border-gray-300"}`}
            >
                <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    ref={fileInputRef}
                    multiple
                    accept={allowedExtensions.join(",")}
                    data-testid="helps_attachment_file_upload"
                />
                <label
                    htmlFor="file-upload"
                    className="cursor-pointer"
                    data-testid="helps_attachment_upload"
                    id="helps_attachment_upload"
                >
                    {isValidating ? (
                        <div className="w-full flex justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : isDragActive ? (
                        <p>Suelta los archivos aquí...</p>
                    ) : (
                        <div>
                            <p>Arrastra y suelta archivos aquí, o haz clic para seleccionar archivos</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Formatos permitidos: {allowedExtensionsString}. Tamaño máximo:{" "}
                                {Math.round(import.meta.env.VITE_MAX_FILE_SIZE_MB || 5)} MB
                            </p>
                        </div>
                    )}
                </label>
            </div>

            <ScrollArea className="h-60 mt-2">
                <ul className="space-y-2">
                    {listAttachment.length === 0 ? (
                        <div className="flex flex-col gap-4 h-52 items-center justify-center text-center font-semibold">
                            <ImageOff height={50} width={50} />{" "}
                            <p className="text-gray-500">no hay adjuntos cargados en este momento</p>
                        </div>
                    ) : (
                        listAttachment.map((file, index) => (
                            <li key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded">
                                <div className="flex items-center">
                                    <File className="mr-2 h-4 w-4" />
                                    <span className="text-sm truncate max-w-[180px]">{file.fileName || file.path}</span>
                                </div>
                                <div>
                                    {!localPath.pathname.includes("/create") && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => getAttachment(file)}
                                            type="button"
                                            id="btn_attachmment"
                                            data-testid="btn_attachmment"
                                        >
                                            <DownloadIcon className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteAttachment(file)}
                                        type="button"
                                        disabled={isPendingDelete}
                                        id={formatTestId("btn_attachmment_delete", `${file.fileName}`)}
                                        data-testid={formatTestId("btn_attachmment_delete", `${file.fileName}`)}
                                    >
                                        {!isPendingDelete ? (
                                            <X className="h-4 w-4 text-red-400" />
                                        ) : (
                                            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                                        )}
                                    </Button>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </ScrollArea>
        </div>
    );
}

HelpsAttachment.propTypes = {
    handleFiles: PropTypes.func.isRequired,
    listAttachment: PropTypes.array,
    getAttachment: PropTypes.func.isRequired,
    deleteAttachment: PropTypes.func.isRequired,
    isPendingDelete: PropTypes.bool
}
