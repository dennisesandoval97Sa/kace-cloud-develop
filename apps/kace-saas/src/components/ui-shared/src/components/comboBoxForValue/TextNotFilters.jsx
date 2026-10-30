import { Filter } from "lucide-react"
import { useTranslation } from "react-i18next"

export const TextNotFilters = () => {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col justify-center items-center text-center gap-2">
            <div className="flex flex-col justify-center items-center">
                <Filter size={30} /> <span className="font-semibold text-gray-400">{t("text.no_filters")}</span>
            </div>
            <p className="text-sm">
                {t("text.filter_text")}
            </p>
        </div>
    )
}
