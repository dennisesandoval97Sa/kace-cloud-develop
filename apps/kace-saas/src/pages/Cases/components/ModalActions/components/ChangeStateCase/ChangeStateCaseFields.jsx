import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { KField } from "@kace/ui-shared";
import { SelectByUrl } from "@/components/core/SelectByUrl/SelectByUrl";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

/**
 * Campo puro de selección de transición/estado siguiente, sin Formik/Form
 * propio, reutilizado por la sección "Cambiar estado" del modal combinado de
 * acciones masivas. Las transiciones disponibles se calculan a partir del
 * primer caso seleccionado, igual que en el flujo bulk actual.
 */
export const ChangeStateCaseFields = ({ caseId, errors, touched, values, setFieldValue }) => {
    const { t } = useTranslation();

    if (!caseId) return null;

    return (
        <div className="grid gap-4">
            <KField>
                <SelectByUrl
                    name="transicion_id"
                    url={`${URL_AND_KEYS.cases.urlCaseAvailableStates}/${caseId}`}
                    keyQuery={[URL_AND_KEYS.cases.urlCaseAvailableStates, caseId]}
                    setFieldValue={setFieldValue}
                    label={t("generalSetup.form.labels.state")}
                    itemLabel="estado_siguiente.nombre"
                    valueFrom="transition.id"
                    value={values.transicion_id}
                    error={errors.transicion_id}
                    touched={Boolean(touched.transicion_id || values.transicion_id)}
                    method="get"
                    errorLayout="stacked"
                />
            </KField>
        </div>
    );
};

ChangeStateCaseFields.propTypes = {
    caseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    errors: PropTypes.object.isRequired,
    touched: PropTypes.object.isRequired,
    values: PropTypes.object.isRequired,
    setFieldValue: PropTypes.func.isRequired,
};
