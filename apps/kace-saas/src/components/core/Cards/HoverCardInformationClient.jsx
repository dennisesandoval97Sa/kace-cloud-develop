import { CalendarDays, CircleUserRound } from "lucide-react";
import { PropTypes } from "prop-types";

import { HoverCard, HoverCardContent, HoverCardTrigger, Button } from "@kace/ui-shared";
import { formatUserFullName } from "@/utils/userDisplay";

export function HoverCardInformationClient({ data = {}, birthday = "", nombres = "" }) {
    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <Button variant="link" className="p-0 h-auto text-greenCustom" type="button">
                    Mas información
                </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
                <div className="flex justify-between space-x-4">
                    <CircleUserRound className="h-14 w-14" />
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold">
                            {formatUserFullName({ nombres, apellido1: data.apellido1, apellido2: data.apellido2 })}
                        </h4>
                        <p className="text-sm">
                            <span className="font-bold">Tipo cliente: </span>
                            {data.tipo_cliente}
                        </p>
                        <p className="text-sm">
                            <span className="font-bold">Tipo documento: </span>
                            {data.tipo_documento}
                        </p>
                        <p className="text-sm">
                            <span className="font-bold">Documento: </span>
                            {data.documento}
                        </p>
                        <p className="text-sm">
                            <span className="font-bold">Email alterno: </span>
                            {data.email_alterno || "N/A"}
                        </p>
                        <p className="text-sm">
                            <span className="font-bold">Estado civil: </span>
                            {data.estado_civil || "N/A"}
                        </p>
                        <p className="text-sm">
                            <span className="font-bold">Genero: </span>
                            {data.sexo || "N/A"}
                        </p>
                        <p className="text-sm">
                            <span className="font-bold">Teléfono alterno: </span>
                            {data.telefono_alterno || "N/A"}
                        </p>
                        <div className="flex items-center pt-2">
                            <CalendarDays className="mr-2 h-4 w-4 opacity-70" />{" "}
                            <span className="text-xs text-muted-foreground">{birthday}</span>
                        </div>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}

HoverCardInformationClient.propTypes = {
    data: PropTypes.object,
    birthday: PropTypes.string,
    nombres: PropTypes.string,
};
