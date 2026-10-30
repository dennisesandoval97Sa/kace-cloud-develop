import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui-shared"
import PropTypes from "prop-types"
import { useTranslation } from "react-i18next"
import { stringify } from "yaml";

const EventDetailsModal = ({ isOpen, onClose, eventData }) => {
    const { t } = useTranslation();

    if (!isOpen) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto sm:max-w-2xl">
                <DialogHeader>
                    <div className="flex flex-row justify-between items-center pr-10">
                        <div>

                            <DialogTitle>{t("event_logs.eventDetails")}</DialogTitle>
                            <DialogDescription>
                                {t("event_logs.eventDetails")}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <pre className="text-sm text-gray-700 pr-8">
                    {
                        stringify(eventData.body, (key, value) => {
                            if (value === "") {
                                return undefined;
                            }
                            return value;
                        })
                    }
                </pre>
            </DialogContent>
        </Dialog>
    )
}

EventDetailsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    eventData: PropTypes.object.isRequired,
}

export default EventDetailsModal
