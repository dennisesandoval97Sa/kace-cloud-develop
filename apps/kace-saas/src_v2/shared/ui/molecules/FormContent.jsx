import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { useNavigate } from "react-router-dom";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { ChevronLeft } from "lucide-react";

const FormContent = ({
    className,
    title,
    labelButton,
    disabledButton = false,
    isSending,
    onBack,
    children,
    ...props
}) => {
    const navigation = useNavigate();

    /*
     * Volver al historial es el comportamiento por defecto porque este molecule no conoce el
     * modulo que lo monta; `onBack` esta para los formularios que si saben a que listado
     * pertenecen y no quieren depender de por donde llego el usuario.
     */
    const handleBack = onBack ?? (() => navigation(-1));

    return (
        <div className="flex flex-col gap-8 p-4 w-full h-full" {...props}>
            <div className="flex w-full h-auto items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleBack}
                    type="button"
                    id="btn_back_form_card"
                    data-testid="btn_back_form_card"
                >
                    <ChevronLeft />
                </Button>
                <h2 className="font-bold text-2xl p-2 w-full">{title}</h2>
                <Button
                    type="submit"
                    disabled={disabledButton || isSending}
                    className={cn({ "cursor-not-allowed opacity-40": isSending })}
                >
                    {isSending ? "Enviando..." : labelButton}
                </Button>
            </div>
            <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", className)}>{children}</div>
        </div>
    );
};

FormContent.propTypes = {
    className: PropTypes.string,
    title: PropTypes.string,
    labelButton: PropTypes.string,
    disabledButton: PropTypes.bool,
    isSending: PropTypes.bool,
    onBack: PropTypes.func,
    children: PropTypes.node,
};

export default FormContent;
