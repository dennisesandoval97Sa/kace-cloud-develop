import { useState, useEffect } from "react"
import { PropTypes } from "prop-types"
import { LogoIcon } from "../ui-shared/src/icons"

export const ScreenSizeWarning = ({ minWidth = 1024 }) => {
    const [isScreenTooSmall, setIsScreenTooSmall] = useState(false)

    useEffect(() => {
        const checkScreenSize = () => {
            setIsScreenTooSmall(window.innerWidth < minWidth)
        }

        checkScreenSize()

        window.addEventListener("resize", checkScreenSize)

        return () => {
            window.removeEventListener("resize", checkScreenSize)
        }
    }, [minWidth])

    if (!isScreenTooSmall) {
        return null
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-100 z-50 animate-fadeIn">
            <div className="text-center text-white px-4">
                <div className="flex justify-center">
                    <LogoIcon width={150} height={150} />
                </div>
                <h1 className="text-4xl font-bold">
                    Estamos mejorando tu experiencia
                </h1>
                <p className="mt-4 text-lg">
                    Nuestra aplicación está optimizada para pantallas más
                    grandes para garantizar la mejor experiencia. Estamos
                    trabajando para que sea accesible y funcional en todos los
                    dispositivos. Por ahora, utilice una pantalla más grande
                    para continuar.
                </p>
                <p className="mt-4 text-sm text-gray-300">
                    ¡Gracias por su comprensión y paciencia mientras mejoramos
                    nuestra plataforma!
                </p>
            </div>
        </div>
    )
}

ScreenSizeWarning.propTypes = {
    minWidth: PropTypes.number
}
