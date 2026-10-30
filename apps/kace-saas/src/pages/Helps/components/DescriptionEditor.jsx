import React from "react"
import { RichEditor } from "../../../components/core/Editor/Editor"
import { Label } from "@kace/ui-shared"
import { t } from "i18next"

export const DescriptionEditor = ({ value, setValue, touched, error }) => {
    return (
        <div>
            <div className="flex w-full justify-between items-center">
                <Label
                    htmlFor="description-help"
                    className={`text-sm text-right flex justify-end ${touched && error && "text-redCustom font-semibold"} mb-2`}
                    id="description_editor_help"
                    data-testid="description_editor_help"
                >
                    {`${t("template.form.labels.descripcion")} *`}
                </Label>
                {touched && error && (
                    <Label className="text-redCustom font-semibold">
                        {error}
                    </Label>
                )}
            </div>
            <RichEditor
                value={value}
                setValue={setValue}
                name="descripcion"
            />
        </div>
    )
}
