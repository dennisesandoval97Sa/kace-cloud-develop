import { TYPE_DOCUMENT } from "@kace/utils";
import { useFormikContext } from "formik";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ButtonSection } from "./ButtonSection";

export const TypeClientComponent = ({ handleResetUser }) => {
    const { t } = useTranslation();
    const tc = (key) => t(`globalConfigLabels.clientes.${key}`);
    const { values } = useFormikContext();
    const value = values.tipo_documento;
    const [typeCliente, setTypeCliente] = useState(tc("nombre_tipo_natural"));

    useEffect(() => {
        if (value === TYPE_DOCUMENT.NIT) {
            setTypeCliente(tc("nombre_tipo_comercial"));
        } else {
            setTypeCliente(tc("nombre_tipo_natural"));
        }
    }, [value]);

    return (
        <div className="flex justify-between p-2 items-center">
            <p>
                {tc("tipo")}: <span className="font-bold">{typeCliente}</span>
            </p>
            <div className="flex gap-2">
                <ButtonSection resetUser={handleResetUser} />
            </div>
        </div>
    );
};

TypeClientComponent.propTypes = {
    handleResetUser: PropTypes.func.isRequired,
};
