import PropTypes from "prop-types";
import { InputForm as Input, KField, SelectByProvider, DatePicker } from "@kace/ui-shared";
import { joiFormikAdapter, TYPE_DOCUMENT } from "@kace/utils";
import { Form, Formik } from "formik";
import { useCallback, useEffect, useRef, useState } from "react";
import { MultiSelectClientForm } from "../../../../../../components/core/multiselector/MultiSelectClientForm";
import { ClientCreateSchemaForm } from "../../../../../../schemas/ClientSchema";
import { CLIENT_SERVICE } from "../../../../../../utils/URL";
import { useAgentContext } from "../../../../context/AgentContext";
import useAgentFormEditConfig from "../../hooks/useAgentFormEditConfig";
import useClientsManagement from "../../hooks/useClientsManagement";
import useSaveClient from "../../hooks/useSaveClient";
import FieldInput from "./components/FieldInput";
import { NaturalPersonFields } from "./components/NaturalPersonFields";
import { SelectLiterals } from "./components/SelectLiterals";
import { TypeClientComponent } from "./components/TypeClientComponent";
import { formatClientData } from "./utils/clientUtils";
import useAgentFormConfig from "../../../../hooks/useAgentFormConfig";
import useAgentFormCopyConfig from "../../../../hooks/useAgentFormCopyConfig";
import { format, isDate, parseISO } from "date-fns";
import { TYPE_CUSTOMER } from "@/utils/main";

export const ClientForm = ({ client, onCloseInteractionClient = null, onInteractionClient = null }) => {
    const { clientId, isNewClient, dataUserSelected, configAgent } = useAgentContext();
    const { AgentNameFields, clients: configClients } = configAgent;

    const stateData = client || dataUserSelected;

    const [clientData, setClientData] = useState(stateData);
    const [listValues, setListValues] = useState([]);
    const { saveClient } = useSaveClient();
    const { validateFieldsEdit } = useAgentFormEditConfig(clientId, isNewClient);
    const { clientSchemaForm } = useAgentFormConfig(ClientCreateSchemaForm);
    const { validateFieldsCopyPaste } = useAgentFormCopyConfig();
    const { handleUsers, dataLiterals, handleSetLiteral } = useClientsManagement();
    const timeoutRef = useRef(null);
    const isFirstChange = useRef(true);

    const handleResetUser = useCallback(() => {
        setListValues([]);
    }, []);

    useEffect(() => {
        if (client && Object.keys(client).length > 0) {
            setClientData(formatClientData(client));
        } else if (dataUserSelected && Object.keys(dataUserSelected).length !== 0) {
            setClientData(formatClientData(dataUserSelected));
        }
    }, [client, dataUserSelected]);

    const hideEmpresa = true;

    const handleTempClient = useCallback(
        async (values) => {
            if (values.tipo_documento === TYPE_DOCUMENT.NIT) {
                values.tipo_cliente = TYPE_CUSTOMER.COMMERCIAL;
            } else {
                values.tipo_cliente = TYPE_CUSTOMER.NATURAL;
            }

            await saveClient(values, clientId, isNewClient);
        },
        [clientId, isNewClient],
    );

    return (
        <Formik
            enableReinitialize={true}
            initialValues={clientData}
            validationSchema={joiFormikAdapter(clientSchemaForm)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                try {
                    await handleTempClient(values);
                    if (configClients?.custom_form_id === "") {
                        const parsedDate = isDate(values.fecha_nacimiento)
                            ? values.fecha_nacimiento
                            : parseISO(values.fecha_nacimiento);
                        values.fecha_nacimiento =
                            isDate(parsedDate) && !isNaN(parsedDate) ? format(parsedDate, "yyyy-MM-dd") : "";
                        handleUsers(values, setErrors, setStatus, clientId, isNewClient);
                    }
                    if (onInteractionClient) {
                        onInteractionClient();
                    }
                    if (onCloseInteractionClient) {
                        onCloseInteractionClient();
                    }
                } catch (error) {
                    throw new Error("Error al guardar: " + error);
                }
            }}
        >
            {({ values, setValues, errors, touched, setFieldValue, initialValues }) => {
                // NO-SONAR: se requiere utilizar el hook con la funcion setFieldValue y values de Formik
                useEffect(() => {
                    if (configClients?.custom_form_id !== "") {
                        if (isFirstChange.current < 3) {
                            isFirstChange.current += 1;
                        } else {
                            clearTimeout(timeoutRef.current);
                            timeoutRef.current = setTimeout(async () => {
                                await handleTempClient(values);
                            }, 800);
                        }
                    }
                }, [values, configClients, handleTempClient]);

                // NO-SONAR: se requiere utilizar el hook con la funcion setFieldValue y values de Formik
                useEffect(() => {
                    if (!values.tipo_documento) {
                        return;
                    }
                    if (values.tipo_documento.toString().toUpperCase() === TYPE_DOCUMENT.NIT) {
                        setTimeout(() => {
                            setFieldValue("nombres", "");
                        }, 100);
                    } else {
                        setFieldValue("nombre_empresa", "");
                    }
                }, [values.tipo_documento, setFieldValue]);

                return (
                    <Form
                        className="flex flex-col gap-2 border-input border rounded-md justify-between bg-background overflow-auto"
                        autoComplete="off"
                    >
                        <TypeClientComponent value={values.tipo_documento} handleResetUser={handleResetUser} />

                        <div className="flex flex-wrap justify-end gap-2 overflow-auto">
                            {configClients?.fields?.field_tipo_documento && (
                                <div className="p-2 rounded-md flex-1 min-w-[300px]">
                                    {validateFieldsEdit("tipo_documento") && (
                                        <KField>
                                            <Input
                                                type="text"
                                                name="tipo_documento"
                                                label={AgentNameFields.clients.tipo_documento}
                                                placeholder={AgentNameFields.clients.tipo_documento}
                                                className="flex flex-col items-start justify-start text-start"
                                                disabled={validateFieldsEdit("tipo_documento")}
                                            />
                                        </KField>
                                    )}
                                    {!validateFieldsEdit("tipo_documento") && (
                                        <SelectLiterals
                                            handleOptions={handleSetLiteral}
                                            currentData={dataLiterals}
                                            name="tipo_documento"
                                            value={values.tipo_documento}
                                            error={errors.tipo_documento}
                                            initialValue={initialValues.tipo_documento}
                                            touched={touched.tipo_documento}
                                            setField={setFieldValue}
                                            fieldLabel={AgentNameFields.clients.tipo_documento}
                                        />
                                    )}
                                </div>
                            )}

                            {values.tipo_documento === TYPE_DOCUMENT.NIT ? (
                                <div className="p-2 rounded-md flex-1 min-w-[300px]">
                                    <KField>
                                        <Input
                                            type="text"
                                            touchedValue={true}
                                            name="nombre_empresa"
                                            label={AgentNameFields?.clients?.nombre_empresa ?? ""}
                                            placeholder={AgentNameFields?.clients?.nombre_empresa ?? ""}
                                            className="flex flex-col items-start justify-start text-start"
                                            disabled={validateFieldsEdit("nombre_empresa")}
                                            onKeyDown={validateFieldsCopyPaste("nombre_empresa")}
                                        />
                                    </KField>
                                </div>
                            ) : (
                                <NaturalPersonFields
                                    AgentNameFields={AgentNameFields}
                                    search_clients={configClients?.fields}
                                    validateFieldsEdit={validateFieldsEdit}
                                    validateFieldsCopyPaste={validateFieldsCopyPaste}
                                />
                            )}

                            {configClients?.fields?.field_documento && (
                                <FieldInput
                                    name="documento"
                                    label={AgentNameFields.clients.documento}
                                    disabled={validateFieldsEdit("documento")}
                                    onKeyDown={validateFieldsCopyPaste("documento")}
                                />
                            )}
                            {configClients?.fields?.field_email && (
                                <FieldInput
                                    name="email"
                                    label={AgentNameFields.clients.email}
                                    disabled={validateFieldsEdit("email")}
                                    onKeyDown={validateFieldsCopyPaste("email")}
                                />
                            )}
                            {configClients?.fields?.field_email_alterno && (
                                <FieldInput
                                    name="email_alterno"
                                    label={AgentNameFields.clients.email_alterno}
                                    disabled={validateFieldsEdit("email_alterno")}
                                    onKeyDown={validateFieldsCopyPaste("email_alterno")}
                                />
                            )}
                            {configClients?.fields?.field_telefono && (
                                <FieldInput
                                    name="telefono"
                                    label={AgentNameFields.clients.telefono}
                                    disabled={validateFieldsEdit("telefono")}
                                    onKeyDown={validateFieldsCopyPaste("telefono")}
                                />
                            )}
                            {configClients?.fields?.field_telefono_alterno && (
                                <FieldInput
                                    name="telefono_alterno"
                                    label={AgentNameFields.clients.telefono_alterno}
                                    disabled={validateFieldsEdit("telefono_alterno")}
                                    onKeyDown={validateFieldsCopyPaste("telefono_alterno")}
                                />
                            )}
                            {configClients?.fields?.field_sexo && (
                                <FieldInput
                                    name="sexo"
                                    label={AgentNameFields.clients.sexo}
                                    disabled={validateFieldsEdit("sexo")}
                                    onKeyDown={validateFieldsCopyPaste("sexo")}
                                />
                            )}
                            {configClients?.fields?.field_estado_civil && (
                                <FieldInput
                                    name="estado_civil"
                                    label={AgentNameFields.clients.estado_civil}
                                    disabled={validateFieldsEdit("estado_civil")}
                                    onKeyDown={validateFieldsCopyPaste("estado_civil")}
                                />
                            )}
                            {configClients?.fields?.field_fecha_nacimiento && (
                                <div className="p-2 rounded-md flex-1 min-w-[300px]">
                                    <DatePicker
                                        value={values.fecha_nacimiento}
                                        placeholder={AgentNameFields.clients.fecha_nacimiento}
                                        label={AgentNameFields.clients.fecha_nacimiento}
                                        disabled={validateFieldsEdit("fecha_nacimiento")}
                                        onChange={(values) => setFieldValue("fecha_nacimiento", values)}
                                        error={errors.fecha_nacimiento}
                                        errorMessage={errors.fecha_nacimiento}
                                        showTimeSelect
                                        dateFormat="Pp"
                                        customInput={<Input className="cursor-pointer" />}
                                        isBirthDatePicker
                                    />
                                </div>
                            )}
                            {configClients?.fields?.field_campos_extra1 && (
                                <FieldInput
                                    name="campos_extra1"
                                    label={AgentNameFields.clients.campos_extra1}
                                    disabled={validateFieldsEdit("campos_extra1")}
                                    onKeyDown={validateFieldsCopyPaste("campos_extra1")}
                                />
                            )}
                            {configClients?.fields?.field_campos_extra2 && (
                                <FieldInput
                                    name="campos_extra2"
                                    label={AgentNameFields.clients.campos_extra2}
                                    disabled={validateFieldsEdit("campos_extra2")}
                                    onKeyDown={validateFieldsCopyPaste("campos_extra2")}
                                />
                            )}
                            {configClients?.fields?.field_campos_extra3 && (
                                <FieldInput
                                    name="campos_extra3"
                                    label={AgentNameFields.clients.campos_extra3}
                                    disabled={validateFieldsEdit("campos_extra3")}
                                    onKeyDown={validateFieldsCopyPaste("campos_extra3")}
                                />
                            )}

                            <div className={hideEmpresa ? "hidden" : "p-2 rounded-md flex-1 min-w-[300px]"}>
                                {values.tipo_documento !== TYPE_DOCUMENT.NIT ? (
                                    <SelectByProvider
                                        name="padre_id"
                                        label="Empresa"
                                        url={CLIENT_SERVICE}
                                        labelFrom="nombres"
                                        valueFrom="id"
                                    />
                                ) : (
                                    <div className="col-span-12 md:col-span-8 xl:col-span-6">
                                        <label htmlFor="">Usuarios:</label>
                                        <MultiSelectClientForm
                                            listValues={listValues}
                                            setListValues={setListValues}
                                            setValues={setValues}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </Form>
                );
            }}
        </Formik>
    );
};

ClientForm.propTypes = {
    client: PropTypes.shape({
        id: PropTypes.string,
        nombres: PropTypes.string,
        apellido1: PropTypes.string,
        apellido2: PropTypes.string,
        email: PropTypes.string,
        telefono: PropTypes.string,
        movil: PropTypes.string,
    }),
    onCloseInteractionClient: PropTypes.func,
    onInteractionClient: PropTypes.func,
};
