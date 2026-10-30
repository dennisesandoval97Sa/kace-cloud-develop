import { PropTypes } from "prop-types";
import { useState, useEffect, useMemo } from "react";

import { Mail, UserRound, Phone, CalendarDays, Heart } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, Avatar, AvatarImage, AvatarFallback } from "@kace/ui-shared";
import { GeneralLoader } from "../../ui-shared";
import { useTranslation } from "react-i18next";
import { formatUserFullName } from "@/utils/userDisplay";

export const CaseCustomerCard = ({ data }) => {
    const { t } = useTranslation();

    const {
        nombres,
        apellido1,
        apellido2,
        email,
        email_alterno,
        telefono,
        telefono_alterno,
        fecha_nacimiento,
        sexo,
        estado_civil,
        tipo_cliente,
        tipo_documento,
        documento,
        nombre_empresa,
    } = data;

    const isNatural = data.tipo_cliente === "Natural";
    const [birthday, setBirthday] = useState(null);

    const name = nombres || nombre_empresa;

    const fullNameClient = isNatural ? formatUserFullName({ nombres, apellido1, apellido2 }) : nombre_empresa || "";

    const initials = useMemo(() => {
        if (!name) return null;

        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
    }, []);

    const handleBirthday = () => {
        if (fecha_nacimiento) {
            const date = new Date(fecha_nacimiento);
            const month = date.toLocaleString("es-ES", { month: "long" });
            const day = date.getDate();
            const year = date.getFullYear();
            setBirthday(`${day} de ${month} de ${year}`);
        }
    };

    useEffect(() => {
        handleBirthday();
    }, [fecha_nacimiento, nombres]);

    const typeDocument = tipo_documento === "CEDULA CIUDADANIA" ? t("generalSetup.form.title.cc") : tipo_documento;

    if (!data) {
        return <GeneralLoader />;
    }

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row justify-between items-start px-4 py-3 border-b">
                <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 bg-muted/50" id="case_card_avatar" data-testid="case_card_avatar">
                        <AvatarImage src="" alt="Foto de perfil" />
                        <AvatarFallback className="font-medium">{isNatural ? initials : "EMP"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <CardTitle
                            className="text-xl font-semibold"
                            id="case_card_fullname"
                            data-testid="case_card_fullname"
                        >
                            {fullNameClient}
                        </CardTitle>
                        <div className="flex gap-2 mt-1">
                            <span
                                className="text-sm bg-primary px-2 py-1 rounded-md"
                                id="case_card_type_client"
                                data-testid="case_card_type_client"
                            >
                                {tipo_cliente}
                            </span>
                            {isNatural && sexo && (
                                <span
                                    className="text-sm bg-secondary px-2 py-1 rounded-md"
                                    id="case_card_gender"
                                    data-testid="case_card_gender"
                                >
                                    {sexo}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="grid gap-3 p-4">
                <div className="grid gap-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{t("app.forms.infoPersonalCase")}</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm" id="case_card_document" data-testid="case_card_document">
                                {typeDocument}: {documento}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm" id="case_card_birthday" data-testid="case_card_birthday">
                                {birthday || t("generalSetup.form.labels.notSpecified")}
                            </span>
                        </div>
                        <div className={`flex items-center gap-2 ${!isNatural && "hidden"}`}>
                            <Heart className="h-4 w-4 text-muted-foreground" />
                            <span
                                className="text-sm"
                                id="case_card_marital_status"
                                data-testid="case_card_marital_status"
                            >
                                {estado_civil || t("generalSetup.form.labels.notSpecified")}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid gap-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                        {t("generalSetup.form.title.contact")}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-sm">{email}</span>
                                {email_alterno && (
                                    <span
                                        className="text-xs text-muted-foreground"
                                        id="case_card_email"
                                        data-testid="case_card_email"
                                    >
                                        {t("generalSetup.form.labels.secondary")}: {email_alterno}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-sm" id="case_card_phone" data-testid="case_card_phone">
                                    {telefono || t("generalSetup.form.labels.notSpecified")}
                                </span>
                                {telefono_alterno && (
                                    <span className="text-xs text-muted-foreground">
                                        {t("generalSetup.form.labels.secondary")}: {telefono_alterno}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

CaseCustomerCard.propTypes = {
    data: PropTypes.object,
};
