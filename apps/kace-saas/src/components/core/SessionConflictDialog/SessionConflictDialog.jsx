import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const SessionConflictDialog = ({ onConfirm, onReject }) => {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("app.text.sessionConflictTitle")}</h2>
                <p className="text-sm text-gray-600 mb-6">{t("app.text.sessionConflictBody")}</p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onReject}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        {t("app.text.sessionConflictCancel")}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                        {t("app.text.sessionConflictConfirm")}
                    </button>
                </div>
            </div>
        </div>
    );
};

SessionConflictDialog.propTypes = {
    onConfirm: PropTypes.func.isRequired,
    onReject: PropTypes.func.isRequired,
};

export default SessionConflictDialog;
