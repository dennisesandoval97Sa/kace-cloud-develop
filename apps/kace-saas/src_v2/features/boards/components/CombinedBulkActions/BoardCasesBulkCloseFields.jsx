import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import TextareaField from "@kace_v2/shared/ui/molecules/TextareaField";
import { CharacterCount } from "@kace_v2/shared/ui/atoms/CharacterCount";
import { CLOSE_REASON_MAX_LENGTH } from "@/constants/closeReason";

/**
 * Campo puro de motivo de cierre para acciones masivas de tableros, sin
 * Formik/Form propio, reutilizado por la sección "Cerrar caso" del modal
 * combinado de acciones masivas.
 */
export const BoardCasesBulkCloseFields = ({ errors, values, setFieldValue }) => {
    const { t } = useTranslation();
    const currentLength = (values.close_reason ?? "").length;

    return (
        <div className="grid gap-4">
            <TextareaField
                label={t("boards.bulkActions.closeModal.closeReason")}
                placeholder={t("boards.bulkActions.closeModal.closeReasonPlaceholder")}
                name="close_reason"
                value={values.close_reason}
                onChange={(event) => setFieldValue("close_reason", event.target.value)}
                error={errors.close_reason}
                maxLength={CLOSE_REASON_MAX_LENGTH}
                data-testid="board_close_reason_input"
            />
            <div className="flex justify-end">
                <CharacterCount current={currentLength} max={CLOSE_REASON_MAX_LENGTH} id="board_close_reason_counter" />
            </div>
        </div>
    );
};

BoardCasesBulkCloseFields.propTypes = {
    errors: PropTypes.object.isRequired,
    values: PropTypes.object.isRequired,
    setFieldValue: PropTypes.func.isRequired,
};
