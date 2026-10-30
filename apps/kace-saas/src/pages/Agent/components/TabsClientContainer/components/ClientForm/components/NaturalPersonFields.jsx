import { InputForm as Input, KField } from "@kace/ui-shared"
import PropTypes from "prop-types"
import { FieldWrapper } from "./FieldWrapper"

export const NaturalPersonFields = ({
    AgentNameFields,
    search_clients,
    validateFieldsEdit,
    validateFieldsCopyPaste
}) => {
    return (
        <>
            {search_clients?.field_nombres && (
                <FieldWrapper>
                    <KField>
                        <Input
                            type="text"
                            name="nombres"
                            label={AgentNameFields?.clients?.nombres ?? ""}
                            placeholder={AgentNameFields?.clients?.nombres ?? ""}
                            className="flex flex-col items-start justify-start text-start"
                            disabled={validateFieldsEdit("nombres")}
                            onKeyDown={validateFieldsCopyPaste("nombres")}
                        />
                    </KField>
                </FieldWrapper>
            )}

            {search_clients?.field_apellido1 && (
                <FieldWrapper>
                    <KField>
                        <Input
                            type="text"
                            name="apellido1"
                            label={AgentNameFields?.clients?.apellido1 ?? ""}
                            placeholder={AgentNameFields?.clients?.apellido1 ?? ""}
                            className="flex flex-col items-start justify-start text-start"
                            disabled={validateFieldsEdit("apellido1")}
                            onKeyDown={validateFieldsCopyPaste("apellido1")}
                        />
                    </KField>
                </FieldWrapper>
            )}

            {search_clients?.field_apellido2 && (
                <FieldWrapper>
                    <KField>
                        <Input
                            type="text"
                            name="apellido2"
                            label={AgentNameFields?.clients?.apellido2 ?? ""}
                            placeholder={AgentNameFields?.clients?.apellido2 ?? ""}
                            className="flex flex-col items-start justify-start text-start"
                            disabled={validateFieldsEdit("apellido2")}
                            onKeyDown={validateFieldsCopyPaste("apellido2")}
                        />
                    </KField>
                </FieldWrapper>
            )}
        </>
    )
}

NaturalPersonFields.propTypes = {
    AgentNameFields: PropTypes.object,
    search_clients: PropTypes.object,
    validateFieldsEdit: PropTypes.func.isRequired,
    validateFieldsCopyPaste: PropTypes.func.isRequired
}
