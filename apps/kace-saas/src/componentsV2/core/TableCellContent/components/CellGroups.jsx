import PropTypes from "prop-types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui-shared";

const MAX_INLINE = 2;

/*
 * Titulo del modal segun la columna. Sin entrada aqui se cae a "Grupos", que es lo que
 * mostraba esta celda cuando solo servia a la columna `groups` de Usuarios.
 */
const DIALOG_TITLE_KEY_BY_COLUMN = {
    access_users: ["app.text.users", "Usuarios"],
    access_groups: ["app.text.groups", "Grupos"],
};

/**
 * Lista de chips con corte en MAX_INLINE y un "+N" que abre el detalle completo.
 *
 * Sirve a varias columnas (grupos de un usuario, usuarios y grupos con acceso a un
 * tablero), asi que lee la coleccion por `accessorKey` en lugar de por un campo fijo,
 * y acepta tanto `{ id, nombre }` como `{ id, label }`.
 */
const CellGroups = ({ row, accessorKey = "groups" }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const items = row.original[accessorKey];

    if (!Array.isArray(items) || items.length === 0) {
        return <span className="text-gray-400">—</span>;
    }

    const labelOf = (item) => item?.nombre ?? item?.label ?? "";
    const [titleKey, titleFallback] = DIALOG_TITLE_KEY_BY_COLUMN[accessorKey] ?? ["app.text.groups", "Grupos"];

    const visible = items.slice(0, MAX_INLINE);
    const hidden = items.length - MAX_INLINE;

    return (
        <div className="flex flex-wrap items-center gap-1">
            {visible.map((item) => (
                <span
                    key={item.id}
                    className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800"
                >
                    {labelOf(item)}
                </span>
            ))}
            {hidden > 0 && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <button
                            type="button"
                            className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                            aria-label={`+${hidden} ${t(titleKey, titleFallback)}`}
                        >
                            +{hidden} {t("app.text.more", "más")}
                        </button>
                    </DialogTrigger>
                    {/*
                     * Altura acotada + scroll en el cuerpo: con muchos elementos el dialogo
                     * centrado se salia del viewport y la lista quedaba inalcanzable.
                     */}
                    <DialogContent className="flex max-h-[min(85vh,32rem)] max-w-sm flex-col overflow-hidden">
                        <DialogHeader className="shrink-0 pr-8">
                            <DialogTitle>{t(titleKey, titleFallback)}</DialogTitle>
                        </DialogHeader>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                            <ul className="flex flex-col gap-1">
                                {items.map((item) => (
                                    <li
                                        key={item.id}
                                        className="rounded px-3 py-1.5 text-sm bg-blue-50 text-blue-800 break-words"
                                    >
                                        {labelOf(item)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

CellGroups.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string,
};

export default CellGroups;
