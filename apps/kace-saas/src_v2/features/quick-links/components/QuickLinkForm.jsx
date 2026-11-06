import { useState } from "react";
import PropTypes from "prop-types";

const initialState = {
    title: "",
    url: "",
    position: "",
    icon: "",
};

const QuickLinkForm = ({ onSubmit, isPending, onCancel }) => {
    const [values, setValues] = useState(initialState);
    const [error, setError] = useState("");

    const submit = async (event) => {
        event.preventDefault();
        setError("");

        const title = values.title.trim();
        const url = values.url.trim();

        if (!title || title.length > 100) {
            return setError("El título es obligatorio y admite hasta 100 caracteres.");
        }

        if (url.length > 500 || !/^https?:\/\//i.test(url)) {
            return setError("La URL debe iniciar con http:// o https:// y admitir hasta 500 caracteres.");
        }

        try {
            const parsed = new URL(url);
            if (!parsed.hostname) {
                return setError("Ingresa una URL válida.");
            }
        } catch {
            return setError("Ingresa una URL válida.");
        }

        if (values.position !== "" && (!Number.isInteger(Number(values.position)) || Number(values.position) < 1)) {
            return setError("La posición debe ser un entero mayor o igual a 1.");
        }

        const payload = { title, url };

        // Enviar únicamente los campos opcionales informados.
        if (values.position !== "") {
            payload.position = Number(values.position);
        }

        if (values.icon.trim()) {
            payload.icon = values.icon.trim();
        }

        try {
            await onSubmit(payload);
            setValues(initialState);
        } catch (error) {
            setError(error?.response?.data?.message ?? "No se pudo crear el enlace.");
        }
    };

    const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900";

    return (
        <form
            onSubmit={submit}
            className="space-y-4 rounded-lg border border-slate-200 p-4"
            aria-label="Crear enlace rápido"
        >
            <h2 className="text-lg font-semibold">Nuevo enlace rápido</h2>

            <label className="block">
                Título *
                <input
                    className={field}
                    value={values.title}
                    maxLength={100}
                    onChange={(e) => setValues({ ...values, title: e.target.value })}
                    required
                />
            </label>

            <label className="block">
                URL *
                <input
                    className={field}
                    type="url"
                    value={values.url}
                    maxLength={500}
                    onChange={(e) => setValues({ ...values, url: e.target.value })}
                    required
                />
            </label>

            <label className="block">
                Posición (opcional)
                <input
                    className={field}
                    type="number"
                    min={1}
                    step={1}
                    value={values.position}
                    onChange={(e) =>
                        setValues({
                            ...values,
                            position: e.target.value,
                        })
                    }
                />
            </label>

            <label className="block">
                Ícono (opcional)
                <input
                    className={field}
                    maxLength={50}
                    value={values.icon}
                    onChange={(e) => setValues({ ...values, icon: e.target.value })}
                />
            </label>

            {error && (
                <p role="alert" className="text-red-700">
                    {error}
                </p>
            )}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
                >
                    {isPending ? "Guardando…" : "Guardar"}
                </button>

                <button type="button" onClick={onCancel} className="rounded border px-4 py-2">
                    Cancelar
                </button>
            </div>
        </form>
    );
};

QuickLinkForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,
    isPending: PropTypes.bool.isRequired,
    onCancel: PropTypes.func.isRequired,
};

export default QuickLinkForm;
