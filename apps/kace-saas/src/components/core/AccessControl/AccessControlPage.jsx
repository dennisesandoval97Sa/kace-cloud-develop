import { useState } from "react";
import { Button } from "@kace/ui-shared";
import { LogoIcon } from "../../ui-shared/src/icons";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import LoadingPage from "../LoaderPage/LoginLoaderPage";

export const AccessControlPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(false);

    const handleRetry = async () => {
        setIsLoading(true);
        try {
            await queryClient.invalidateQueries({ queryKey: ["userInformation"] });
            await queryClient.refetchQueries({ queryKey: ["userInformation"] });
            navigate("/");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <LoadingPage message="Validando permisos, por favor espere..." />;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blueCustom via-primary to-primary">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
                <h2 className="text-2xl font-semibold text-gray-700 mb-6">
                    Verifique el acceso a la aplicación en el rol asignado
                </h2>
                <div className="flex justify-center items-center">
                    <LogoIcon height={150} width={150} color="bg-blueCustom" />
                </div>
                <h1 className="text-4xl font-bold text-gray-800 mb-4">Oops!</h1>
                <h2 className="text-2xl font-semibold text-gray-700 mb-6">Algo salió mal</h2>
                <Button
                    onClick={handleRetry}
                    className="bg-gradient-to-r from-blueCustom to-primary hover:from-blueCustom hover:to-primary text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105"
                >
                    Vamos a intentarlo de nuevo.
                </Button>
            </div>
        </div>
    );
};
