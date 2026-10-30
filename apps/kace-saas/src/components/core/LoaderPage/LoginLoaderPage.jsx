import PropTypes from "prop-types"
import { GeneralLoader } from "../../ui-shared"

export default function LoadingPage ({ message = "Please wait while we fetch your data.", className = "" }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <GeneralLoader className={className}/>
            <h2 className="text-2xl font-semibold mt-6 text-foreground">Cargando...</h2>
            <p className="text-muted-foreground mt-2 text-center max-w-md">{message}</p>
        </div>
    )
}

LoadingPage.propTypes = {
    message: PropTypes.string,
    className: PropTypes.string
}
