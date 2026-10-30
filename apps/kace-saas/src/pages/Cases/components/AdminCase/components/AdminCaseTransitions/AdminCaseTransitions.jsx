import { GeneralLoader } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { getTransitionLabels } from "../../data/constants";
import { AdminCaseTransitionItem } from "./components/AdminCaseTransitionItem";
import useAdminCaseTransitions from "./hooks/useAdminCaseTransitions";

const AdminCaseTransitions = () => {
    const { t } = useTranslation();
    const { transitions, loading } = useAdminCaseTransitions();
    const labels = getTransitionLabels(t);

    if (loading) {
        return (
            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                <GeneralLoader />
            </div>
        );
    }

    return (
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col rounded-md bg-background drop-shadow-md">
            <p className="mt-10 text-center text-2xl font-bold max-sm:text-base">{labels.subTitle}</p>
            {/*
             * La fila de tarjetas ya NO es flex-1: si lo fuera, ocuparía todo el alto restante
             * del panel y items-start (necesario, ver abajo) la dejaría pegada arriba, contra
             * las tabs. En su lugar, flex-1 + justify-center vive en ESTE wrapper: centra la
             * fila COMO BLOQUE (a su altura natural) en el espacio libre, sin tocar cómo se
             * alinean las tarjetas entre sí.
             */}
            <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
                {/*
                 * items-start, no items-center: con items-center cada tarjeta se centra por su
                 * ALTURA TOTAL (encabezado + barra + pie). Un item con más líneas en el pie
                 * (p. ej. "Reclassification:") es más alto, y centrarlo corre su punto/barra
                 * hacia arriba respecto a los vecinos, desalineando el timeline. Con items-start
                 * el punto queda siempre a la misma altura —la del bloque superior, que ya
                 * reserva una altura uniforme— sin importar cuánto texto haya debajo.
                 *
                 * justifyContent: "safe center" inline, no la clase justify-center de Tailwind:
                 * un `justify-content: center` normal, cuando el timeline no cabe (varias
                 * transiciones), deja el PRIMER nodo fuera del área de scroll —scrollLeft no
                 * puede ir negativo— y ya no hay forma de volver a verlo. `safe center`
                 * (soportado en navegadores modernos; Tailwind 3.4 no genera esta arbitrary
                 * value, de ahí el inline) resuelve exactamente ese caso: centra cuando cabe, y
                 * cuando no, cae a alinear desde el inicio para que ningún nodo quede
                 * inalcanzable. Verificado con Playwright contra el CSS compilado.
                 */}
                <div className="flex min-w-0 items-start overflow-auto p-2" style={{ justifyContent: "safe center" }}>
                    {transitions?.length &&
                        transitions.map((item, index) => (
                            <AdminCaseTransitionItem
                                key={`${item.fecha.time}-${index}`}
                                item={item}
                                labels={labels}
                                index={index}
                                countItems={transitions?.length}
                            />
                        ))}
                </div>
            </div>
        </div>
    );
};

export default AdminCaseTransitions;
