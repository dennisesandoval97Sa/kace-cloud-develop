import { cn } from "@kace/ui-shared"
import { Info, XCircle } from "lucide-react"
import PropTypes from "prop-types"
import { useTranslation } from "react-i18next"

const AdminCaseCaseStatusIndicator = ({ title = "", dateTime = "" }) => {
    const { t } = useTranslation()
    return (
        <div
            className={cn(
                "flex items-center flex-col gap-3 rounded-lg px-4 py-3 bg-destructive/10 text-destructive",
                {
                    "bg-orangeCustom/20 text-orangeCustom": !dateTime
                }
            )}
        >
            <div>
                {!dateTime
                    ? (<Info height={50} width={50} />)
                    : (<XCircle height={50} width={50} />)
                }
            </div>
            <div className="flex flex-col gap-0.5 text-center">
                <h3 className="font-semibold">{t(title)}</h3>
                {dateTime && <p className="text-sm text-destructive/80">{`${t("case.text.closingDate")}: ${dateTime}`}</p>}
            </div>
        </div>
    )
}

AdminCaseCaseStatusIndicator.propTypes = {
    title: PropTypes.string,
    dateTime: PropTypes.string
}

export default AdminCaseCaseStatusIndicator
