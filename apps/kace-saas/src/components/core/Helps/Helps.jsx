import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@kace/ui-shared"
import { HelpsCard } from "./components/HelpsCard"
import PropTypes from "prop-types"
import { CircleHelp } from "lucide-react"
import { GeneralLoader } from "../../ui-shared"
import { useTranslation } from "react-i18next"

export const Helps = ({ helpsData = [], isLoading }) => {
    const { t } = useTranslation()
    return (
        <Dialog>
            <DialogTrigger id="helps_dialog_trigger" data-testid="helps_dialog_trigger">
                <CircleHelp />
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px] max-h-[550px] min-h-96 overflow-auto" id="helps_dialog_content" data-testid="helps_dialog_content">
                <DialogHeader>
                    <DialogTitle className="text-3xl" id="helps_dialog_title" data-testid="helps_dialog_title">{t("app.title.helps")} </DialogTitle>
                </DialogHeader >
                {isLoading && <GeneralLoader />}
                {helpsData.length === 0 && <p className="text-center text-gray-500" id="helps_no_data_text" data-testid="helps_no_data_text"
                >{t("app.text.notHelps")}</p>}
                {helpsData.length > 0 &&
                    helpsData.map(({ titulo, descripcion, attachments, color }, index) => (
                        <HelpsCard
                            titulo={titulo}
                            descripcion={descripcion}
                            attachments={attachments}
                            color={color}
                            key={index}
                            id={`helps_card_${index}`}
                            data-testid={`helps_card_${index}`}
                        />
                    ))
                }
            </DialogContent>
        </Dialog>
    )
}

Helps.propTypes = {
    helpsData: PropTypes.array,
    isLoading: PropTypes.bool
}
