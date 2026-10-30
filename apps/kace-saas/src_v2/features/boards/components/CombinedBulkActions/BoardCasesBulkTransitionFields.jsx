import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import useCaseAvailableTransitionsOptions from "@kace_v2/features/boards/hooks/useCaseAvailableTransitionsOptions.hook";

/**
 * Campo puro de selección de transición/estado siguiente para acciones
 * masivas de tableros, sin Formik/Form propio. Las transiciones disponibles
 * se calculan a partir del primer caso seleccionado (caso de referencia).
 */
export const BoardCasesBulkTransitionFields = ({ referenceCaseId, errors, values, setFieldValue }) => {
    const { t } = useTranslation();
    const { data: transitionOptions = [], isLoading } = useCaseAvailableTransitionsOptions(referenceCaseId);

    if (!referenceCaseId) return null;

    return (
        <div className="grid gap-4">
            {!isLoading && transitionOptions.length === 0 ? (
                <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{t("boards.bulkActions.transitionModal.noTransitionsAvailable")}</p>
                </div>
            ) : (
                <SelectField
                    label={t("boards.bulkActions.transitionModal.nextState")}
                    placeholder={t("boards.bulkActions.transitionModal.selectPlaceholder")}
                    options={transitionOptions}
                    isLoading={isLoading}
                    defaultValue={values.transicion_id ? String(values.transicion_id) : ""}
                    value={values.transicion_id ? String(values.transicion_id) : ""}
                    error={errors.transicion_id}
                    onValueChange={(value) => setFieldValue("transicion_id", value)}
                />
            )}
        </div>
    );
};

BoardCasesBulkTransitionFields.propTypes = {
    referenceCaseId: PropTypes.string,
    errors: PropTypes.object.isRequired,
    values: PropTypes.object.isRequired,
    setFieldValue: PropTypes.func.isRequired,
};
