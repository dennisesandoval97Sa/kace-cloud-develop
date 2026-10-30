import { PropTypes } from "prop-types"
import { useNavigate } from "react-router-dom"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { useTranslation } from "react-i18next"

const TitleWithGoBack = ({ title, goBack = false }) => {
    const navigate = useNavigate()
    const { t } = useTranslation()
    document.title = `KACE | ${t(title)}`
    return (
        <div className="flex justify-center items-center">
            {goBack && (
                <button onClick={() => navigate(-1)}>
                    <ArrowLeftIcon className="w-5 mr-2 text-dark hover:text-violet-500 transition-all" />
                </button>
            )}
            <h2 className="text-lg font-bold">{t(title)}</h2>
        </div>
    )
}
TitleWithGoBack.propTypes = {
    title: PropTypes.string.isRequired,
    goBack: PropTypes.bool
}
export default TitleWithGoBack
