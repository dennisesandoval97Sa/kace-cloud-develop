import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminCaseTransitionItem } from "./AdminCaseTransitionItem";

const baseItem = {
    fecha: { date: "21 de septiembre de 2026", time: "05:15:27 PM" },
    actualizador: "andres.yepes",
    responsable: { nombres: "Andres", apellido1: "Yepes", apellido2: "" },
    grupo: "Grupo Prueba",
};

const labels = {
    createdTheCase: "Created the case:",
    madeAnUpdate: "Updated:",
    caseManager: "Case Manager:",
    group: "Group:",
    closingDate: "Closing Date",
    currentState: "State:",
    creator: "Case Creator:",
};

describe("AdminCaseTransitionItem", () => {
    /**
     * AUD-1c: cuando reclasificar y cambiar de estado ocurren en el mismo guardado, el
     * repositorio ya los parte en dos entradas (una de reclasificación sin `estado_siguiente`, y
     * otra normal con el estado). Este nodo no debe MOSTRAR "State:" cuando no hay estado que
     * mostrar — de lo contrario se lee como si el cambio de estado también pasara aquí. Pero el
     * bloque sigue en el DOM (invisible, no ausente): quitarlo del todo deja a este item con una
     * línea menos arriba que sus vecinos y descuadra la tarjeta contra el pie, que sí le agrega
     * la línea de reclasificación.
     */
    it("oculta (invisible, no ausente) la etiqueta de estado en un nodo de reclasificación sin estado_siguiente", () => {
        render(
            <AdminCaseTransitionItem
                item={{
                    ...baseItem,
                    es_reclasificacion: true,
                    estado_siguiente: null,
                    motivo_reclasificacion: "Motivo",
                }}
                labels={labels}
                index={0}
                countItems={2}
            />,
        );

        const stateBlock = screen.getByTestId("transition_item_current_state");
        expect(stateBlock).toBeInTheDocument();
        expect(stateBlock).toHaveClass("invisible");
        expect(stateBlock).toHaveAttribute("aria-hidden", "true");
        expect(screen.getByTestId("transition_item_reclassification")).toBeInTheDocument();
    });

    it("sí muestra la etiqueta de estado en un nodo de cambio de estado normal", () => {
        render(
            <AdminCaseTransitionItem
                item={{ ...baseItem, es_reclasificacion: false, estado_siguiente: "Rechazado" }}
                labels={labels}
                index={0}
                countItems={2}
            />,
        );

        const stateBlock = screen.getByTestId("transition_item_current_state");
        expect(stateBlock).not.toHaveClass("invisible");
        expect(stateBlock).not.toHaveAttribute("aria-hidden");
        expect(screen.getByTestId("state_next_text")).toHaveTextContent("Rechazado");
        expect(screen.queryByTestId("transition_item_reclassification")).not.toBeInTheDocument();
    });

    it("sí muestra la etiqueta de estado en un nodo de reclasificación que también trae estado (sin cambio de estado en el mismo guardado)", () => {
        render(
            <AdminCaseTransitionItem
                item={{
                    ...baseItem,
                    es_reclasificacion: true,
                    estado_siguiente: "En proceso",
                    motivo_reclasificacion: "Motivo",
                }}
                labels={labels}
                index={0}
                countItems={2}
            />,
        );

        expect(screen.getByTestId("transition_item_current_state")).toBeInTheDocument();
        expect(screen.getByTestId("transition_item_reclassification")).toBeInTheDocument();
    });

    it("muestra la etiqueta y nombre del creador cuando creador está presente", () => {
        render(
            <AdminCaseTransitionItem
                item={{
                    ...baseItem,
                    creador: { nombres: "Juan", apellido1: "Pérez", apellido2: "Gómez" },
                    estado_siguiente: "Abierto",
                }}
                labels={labels}
                index={0}
                countItems={2}
            />,
        );

        const creatorBlock = screen.getByTestId("transition_item_creator");
        expect(creatorBlock).toBeInTheDocument();
        expect(creatorBlock).not.toHaveClass("invisible");
        expect(creatorBlock).not.toHaveAttribute("aria-hidden");
        expect(screen.getByTestId("creator_name")).toHaveTextContent("Juan Pérez Gómez");
    });

    it("reserva el espacio (invisible, no ausente) del creador cuando creador es null para mantener la alineación", () => {
        render(
            <AdminCaseTransitionItem
                item={{
                    ...baseItem,
                    creador: null,
                    estado_siguiente: "En proceso",
                }}
                labels={labels}
                index={1}
                countItems={2}
            />,
        );

        const creatorBlock = screen.getByTestId("transition_item_creator");
        expect(creatorBlock).toBeInTheDocument();
        expect(creatorBlock).toHaveClass("invisible");
        expect(creatorBlock).toHaveAttribute("aria-hidden", "true");
    });

    /**
     * La fila del punto es `1fr | auto | 1fr`: el icono vive en la columna del medio y
     * queda centrado bajo el texto tanto con 1 item como con 2+. El lado que no aplica
     * (izquierda del primero, derecha del último) reserva el `1fr` en invisible —si se
     * omite, el único conector `w-full` empuja el icono al borde de la tarjeta.
     */
    const expectCenteredTimeline = () => {
        expect(screen.getByTestId("transition_item_timeline")).toHaveClass("grid-cols-[1fr_auto_1fr]");
        expect(screen.getByTestId("timeline_left_slot")).toBeInTheDocument();
        expect(screen.getByTestId("timeline_right_slot")).toBeInTheDocument();
        expect(screen.getByTestId("timeline_dot")).toBeInTheDocument();
    };

    it("centra el punto cuando es el único item reservando ambos lados invisibles", () => {
        render(
            <AdminCaseTransitionItem
                item={{ ...baseItem, es_reclasificacion: false, estado_siguiente: "Abierto" }}
                labels={labels}
                index={0}
                countItems={1}
            />,
        );

        expectCenteredTimeline();
        expect(screen.getByTestId("timeline_left_slot")).toHaveClass("invisible");
        expect(screen.getByTestId("timeline_right_slot")).toHaveClass("invisible");
    });

    it("reserva ambos lados en el primero y el último item para que el icono quede bajo el texto", () => {
        const { rerender } = render(
            <AdminCaseTransitionItem
                item={{ ...baseItem, es_reclasificacion: false, estado_siguiente: "En proceso" }}
                labels={labels}
                index={0}
                countItems={2}
            />,
        );

        expectCenteredTimeline();
        expect(screen.getByTestId("timeline_left_slot")).toHaveClass("invisible");
        expect(screen.getByTestId("timeline_right_slot")).not.toHaveClass("invisible");

        rerender(
            <AdminCaseTransitionItem
                item={{ ...baseItem, es_reclasificacion: false, estado_siguiente: "Abierto" }}
                labels={labels}
                index={1}
                countItems={2}
            />,
        );

        expectCenteredTimeline();
        expect(screen.getByTestId("timeline_left_slot")).not.toHaveClass("invisible");
        expect(screen.getByTestId("timeline_right_slot")).toHaveClass("invisible");
    });

    it("un item del medio pinta ambos conectores visibles", () => {
        render(
            <AdminCaseTransitionItem
                item={{
                    ...baseItem,
                    es_reclasificacion: true,
                    estado_siguiente: null,
                    motivo_reclasificacion: "Motivo",
                }}
                labels={labels}
                index={1}
                countItems={3}
            />,
        );

        expectCenteredTimeline();
        expect(screen.getByTestId("timeline_left_slot")).not.toHaveClass("invisible");
        expect(screen.getByTestId("timeline_right_slot")).not.toHaveClass("invisible");
        expect(screen.getByTestId("timeline_left_1")).toBeInTheDocument();
        expect(screen.getByTestId("timeline_right_1")).toBeInTheDocument();
    });
});
