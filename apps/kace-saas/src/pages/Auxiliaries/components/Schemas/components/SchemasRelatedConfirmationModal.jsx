import InputCard from "@/components/core/Cards/InputCard"
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    InputForm as Input,
    KField
} from "@/components/ui-shared"
import { useFormikContext } from "formik"
import PropTypes from "prop-types"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const SchemasRelatedConfirmationModal = ({ isOpen, onClose }) => {
    const { t } = useTranslation()
    const { setFieldValue } = useFormikContext()
    const [isCreateNew, setIsCreateNew] = useState(false)
    const { handleSubmit } = useFormikContext()

    if (!isOpen) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[625px] max-h-[550px] overflow-auto">
                <DialogHeader>
                    <DialogTitle>{t("auxSchema.form.schemaInUse")}</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                    {t("auxSchema.form.schemaInUseDescription")}
                </DialogDescription>

                {isCreateNew && (
                    <InputCard>
                        <KField>
                            <Input
                                id="name"
                                name="name"
                                label={t("auxSchema.form.newSchemaName")}
                                placeholder={t("auxSchema.form.newSchemaName")}
                                type="text"
                                className="flex flex-col items-start justify-start text-start"
                            />
                        </KField>
                    </InputCard>
                )}
                <DialogFooter>
                    {!isCreateNew && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsCreateNew(true)
                                setFieldValue("id", "")
                                setFieldValue("name", "")
                            }}
                        >
                            {t("auxSchema.actions.createNew")}
                        </Button>
                    )}
                    <Button
                        onClick={handleSubmit}
                    >
                        {t(`auxSchema.actions.${!isCreateNew ? "updateExisting" : "createNew"}`)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

SchemasRelatedConfirmationModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired
}

export default SchemasRelatedConfirmationModal
