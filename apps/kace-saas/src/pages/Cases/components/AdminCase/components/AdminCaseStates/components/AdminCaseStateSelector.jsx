import { Label, Toggle, ToggleGroup, ToggleGroupItem } from "@kace/ui-shared"
import { useFormikContext } from "formik"
import { CircleX, Waypoints } from "lucide-react"
import PropTypes from "prop-types"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useAdminCaseUserInfo from "../../../hooks/useAdminCaseUserInfo"

const AdminCaseStateSelector = ({ states = [], defaultState = null, statusComponent, isOneScript = false }) => {
    const { t } = useTranslation()
    const [selectedState, setSelectedState] = useState(null)
    const { userCanEditCase } = useAdminCaseUserInfo()
    const { setFieldValue, values, submitForm } = useFormikContext()

    const handleState = useCallback(
        (state) => {
            setSelectedState(state)
            const transition = states.filter((s) => s.state_id === state)
            if (transition[0]?.transition_id && transition[0].transition_id !== values.transicion_id) {
                localStorage.setItem("transitionChanged", true);
            }
            setFieldValue("transicion_id", !state ? localStorage.getItem("last_transition_id") : transition[0]?.transition_id || null, false);

            if (isOneScript && userCanEditCase) {
                submitForm();
            }
        },
        [states, values, userCanEditCase, submitForm, isOneScript],
    )

    useEffect(() => {
        if (!selectedState) {
            localStorage.setItem("transitionChanged", false);
        }
    }, [selectedState])

    return (
        <div className="w-full h-full flex justify-center items-center" id="adm_case_state_selector" data-testid="adm_case_state_selector">
            {
                (states.length === 0 && !defaultState) || !statusComponent.classifications
                    ? (
                        <div className="flex flex-col justify-center items-center gap-2" id="adm_no_status_container" data-testid="adm_no_status_container">
                            <p className="text-xl rounded-md font-bold px-4 py-2 flex flex-col justify-center items-center gap-2" id="adm_no_status_message" data-testid="adm_no_status_message">
                                <Waypoints className="h-14 w-14" />
                                {t("case.text.noStatusAvailable")}{" "}
                                <span className="text-sm text-gray-500 font-normal max-w-[300px] text-center">
                                    {t("app.text.selectClassification")}
                                </span>
                            </p>
                        </div>
                    )
                    : (
                        <div className="flex flex-col justify-center items-center gap-4 h-full" id="adm_status_selector_container" data-testid="adm_status_selector_container">
                            <div className="flex flex-col justify-center items-center gap-2" id="adm_current_state_section" data-testid="adm_current_state_section">
                                <Label className="text-lg font-bold" id="adm_current_state_label" data-testid="adm_current_state_label">
                                    {t("app.text.currentState")}
                                </Label>
                                <Toggle
                                    id="adm_current_state_toggle"
                                    data-testid="adm_current_state_toggle"
                                    aria-label="Toggle underline"
                                    className="bg-greenCustom"
                                    pressed={false}
                                    disabled={!userCanEditCase}
                                >
                                    {defaultState?.nombre || t("app.text.selectState")}
                                </Toggle>
                            </div>
                            {states.length === 0
                                ? (
                                    <div className="w-full flex flex-col justify-center items-center gap-3" id="adm_no_available_states_section" data-testid="adm_no_available_states_section">
                                        <Label id="no_available_states_section" data-testid="no_available_states_section" className="text-lg font-bold">{t("app.text.noAvailableStates")}</Label>
                                        <CircleX className="w-12 h-12 text-gray-600" />
                                    </div>
                                )
                                : <Label className="text-lg font-bold" id="adm_available_states_label" data-testid="adm_available_states_label"
                                >{t("app.text.availableStates")}</Label>
                            }
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                value={selectedState}
                                onValueChange={handleState}
                                className="flex flex-wrap gap-2"
                                disabled={!userCanEditCase}
                                id="adm_available_states_group"
                                data-testid="adm_available_states_group"
                            >
                                {states.map((state) => (
                                    <ToggleGroupItem
                                        key={state.state_id}
                                        value={state.state_id}
                                        className="data-[state=on]:border-2 data-[state=on]:bg-yellowCustom/50 data-[state=on]:border-yellowCustom h-auto min-h-10 max-w-52"
                                        id={`adm_state_option_${state.state_id}`}
                                        data-testid={`adm_state_option_${state.state_id}`}
                                    >
                                        {state.nombre}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        </div>
                    )
            }
        </div >
    )
}

AdminCaseStateSelector.propTypes = {
    states: PropTypes.array.isRequired,
    defaultState: PropTypes.shape({
        id: PropTypes.string,
        nombre: PropTypes.string
    }),
    statusComponent: PropTypes.object,
    isOneScript: PropTypes.bool,
}

export default AdminCaseStateSelector
