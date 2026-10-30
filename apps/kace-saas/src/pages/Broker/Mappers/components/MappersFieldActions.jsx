import { PropTypes } from "prop-types"
import {
    AlertModalShared,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui-shared"
import { MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"

const MappersFieldActions = ({ handleEdit, handleRemove, rowIndex }) => {
    const { t } = useTranslation()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 !bg-transparent !text-gray-600 hover:!bg-gray-100">
                    <span className="sr-only">{t("app.actions.openMenu", "Open menu")}</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleEdit(rowIndex)}>
                    {t("app.forms.edit", "Edit")}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onSelect={(e) =>
                    e.preventDefault()}>
                    <AlertModalShared nameAcceptAction={t("app.forms.delete")} nameCancelAction={t("app.forms.cancel")}
                        handleAcceptAction={() => handleRemove(rowIndex)}
                        buttonAction={
                            <div className="w-full h-full text-red-600">
                                {t("app.forms.delete", "Delete")}
                            </div>
                        }
                    />
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

MappersFieldActions.propTypes = {
    handleEdit: PropTypes.func.isRequired,
    handleRemove: PropTypes.func.isRequired,
    rowIndex: PropTypes.number.isRequired
}

export default MappersFieldActions