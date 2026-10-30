import { PropTypes } from "prop-types"
import { useState, useEffect } from "react"
import { Mail, UserRound, Phone } from "lucide-react"
import {
    Card,
    CardHeader,
    CardContent,
    CardTitle,
    Avatar,
    AvatarImage,
    AvatarFallback
} from "@kace/ui-shared"
import { HoverCardInformationClient } from "./HoverCardInformationClient"

export const CustomerCard = ({
    data: { nombres, email, fecha_nacimiento, nombre_empresa, ...data }
}) => {
    const name = nombres || nombre_empresa
    const [birthday, setBirthday] = useState(null)
    const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()

    const handleBirthday = () => {
        if (fecha_nacimiento) {
            const date = new Date(fecha_nacimiento)
            const month = date.toLocaleString("es-ES", { month: "long" })
            const day = date.getDate()
            const year = date.getFullYear()
            setBirthday(`${day} de ${month} del ${year}`)
        }
    }

    useEffect(() => {
        handleBirthday()
    }, [fecha_nacimiento, nombres])

    return (
        <Card className="w-full h-32">
            <CardHeader className="flex flex-row justify-between px-4 py-2">
                <div className="flex flex-row items-center gap-2">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src="" alt="image user" />
                        <AvatarFallback>{initials || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <CardTitle className="text-lg">{nombres}</CardTitle>
                    </div>
                </div>
                <HoverCardInformationClient
                    data={data}
                    birthday={birthday}
                    nombres={nombres}
                />
            </CardHeader>
            <CardContent className="grid pt-0">
                <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 opacity-70" />
                    <span className="text-sm">
                        {nombres} {data.apellido1}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 opacity-70" />
                    <span className="text-sm">{email}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 opacity-70" />
                    <span className="text-sm">{data.telefono}</span>
                </div>
            </CardContent>
        </Card>
    )
}

CustomerCard.propTypes = {
    data: PropTypes.object
}
