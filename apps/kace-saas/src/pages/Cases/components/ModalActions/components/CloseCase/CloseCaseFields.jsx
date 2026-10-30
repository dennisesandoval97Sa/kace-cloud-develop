import PropTypes from "prop-types";
import { useFormikContext } from "formik";
import { useTranslation } from "react-i18next";
import { KField, TextAreaForm as Textarea } from "@kace/ui-shared";
import { CharacterCount } from "@kace_v2/shared/ui/atoms/CharacterCount";
import { CLOSE_REASON_MAX_LENGTH } from "@/constants/closeReason";

/**
 * Campo puro del formulario de cierre de caso (motivo de cierre), sin
 * Formik/Form propio, reutilizado por el modal individual (CloseCase) y por
 * la sección "Cerrar caso" del modal combinado de acciones masivas.
 */
export const CloseCaseFields = ({ forceShowError = false }) => {
    const { t } = useTranslation();
    const { values } = useFormikContext();
    const currentLength = (values.motivo_baja ?? "").length;

    return (
        <div className="grid gap-4">
            <KField>
                <Textarea
                    name="motivo_baja"
                    label={t("banners.form.description")}
                    placeholder={t("banners.placeholder.description")}
                    className="flex flex-col items-start justify-start text-start"
                    id="textarea_discharge"
                    data-testid="textarea_discharge"
                    maxLength={CLOSE_REASON_MAX_LENGTH}
                    forceShowError={forceShowError}
                    errorLayout="stacked"
                />
            </KField>
            <div className="flex justify-end">
                <CharacterCount current={currentLength} max={CLOSE_REASON_MAX_LENGTH} id="textarea_discharge_counter" />
            </div>
        </div>
    );
};

CloseCaseFields.propTypes = {
    errors: PropTypes.object,
    touched: PropTypes.object,
    values: PropTypes.object,
    setFieldValue: PropTypes.func,
    forceShowError: PropTypes.bool,
};
