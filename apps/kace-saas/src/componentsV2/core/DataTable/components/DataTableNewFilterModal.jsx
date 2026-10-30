import { memo, useCallback, useState } from "react"
import PropTypes from "prop-types"
import {
    Button,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input
} from "@/components/ui-shared"
import { useTranslation } from "react-i18next"

const DataTableNewFilterModal = ({ open, setOpen, onSave }) => {
    const { t } = useTranslation()
    const [name, setName] = useState("")
    const [error, setError] = useState(false)
    const handleChange = useCallback(
        (event) => {
            const value = event.target.value
            setName(value)
            if (value.length < 3 || value.length > 30) {
                setError(true)
                return
            }
            setError(false)
        },
        [setName]
    )

    const handleSubmit = useCallback(() => {
        onSave(name)
        setOpen(false)
    }, [name, onSave, setOpen])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("app.text.newFilter")}</DialogTitle>
                    <DialogDescription>
                        {t("app.text.addFilter")}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                    <div className="grid flex-1 gap-2">
                        <Input id="name" onChange={handleChange} data-testid="dt_newfilter_name" />
                        {error && <p className="text-redCustom">{t("app.alerts.minCharacters")}</p>}
                    </div>
                </div>
                <DialogFooter className="sm:justify-end">
                    <DialogClose asChild>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={error || name.length === 0}
                            id="dt_newfilter_save"
                            data-testid="dt_newfilter_save"
                        >
                            {t("app.button.save")}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

DataTableNewFilterModal.propTypes = {
    open: PropTypes.bool.isRequired,
    setOpen: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired
}

export default memo(DataTableNewFilterModal)
