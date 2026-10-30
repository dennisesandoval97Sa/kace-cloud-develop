import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui-shared";

const PreserveSelectedClientModal = ({ open, onOpenChange, senderEmail, onConfirm, onReject }) => {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="text-center text-lg font-semibold text-gray-900">
                        {t("interactions.client.preserveSelectedClientTitle", {
                            defaultValue: "Keep current Client?",
                        })}
                    </DialogTitle>
                    <DialogDescription className="text-center text-base leading-relaxed text-gray-700">
                        {t("interactions.client.preserveSelectedClientDescription", {
                            defaultValue:
                                "No related Clients were identified for {{email}}. Do you want to keep the current Client?",
                            email: senderEmail,
                        })}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="justify-center gap-3 sm:justify-center">
                    <Button type="button" onClick={onConfirm}>
                        {t("interactions.client.keepSelectedClient", {
                            defaultValue: "Yes, Keep",
                        })}
                    </Button>
                    <Button type="button" variant="outline" onClick={onReject}>
                        {t("interactions.client.discardSelectedClient", {
                            defaultValue: "No, change Client",
                        })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

PreserveSelectedClientModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    senderEmail: PropTypes.string,
    onConfirm: PropTypes.func.isRequired,
    onReject: PropTypes.func.isRequired,
};

export default PreserveSelectedClientModal;
