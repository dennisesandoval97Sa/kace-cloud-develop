import React from "react"
import PropTypes from "prop-types"
import { AlertCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui-shared"

const ChangeHistorySheeError = ({ handle = () => {} }) => {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col items-center justify-center w-full p-6 bg-background rounded-md shadow-md border border-redCustom gap-2">
            <div>
                <AlertCircle className="h-24 w-24 text-red-700" />
            </div>
            <h2 className="text-xl font-bold text-redCustom">{t("dataTable.errors.failedToLoad.title")}</h2>
            <div className="flex items-center space-x-3 text-redCustom">
                <span>{t("dataTable.errors.failedToLoad.description")}</span>
            </div>
            <div>
                <Button onClick={handle} className="bg-greenCustom">
                    {t("dataTable.buttons.reload")}
                </Button>
            </div>
        </div>
    )
}

ChangeHistorySheeError.propTypes = {
    handle: PropTypes.func
}

export default ChangeHistorySheeError
