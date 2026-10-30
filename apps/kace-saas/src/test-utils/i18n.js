/*
 * Helper de tests: simula el `t` de i18next resolviendo la interpolación `{{var}}`.
 * Se usa en los specs de hooks de borrado para verificar la cadena final que ve el
 * usuario y no sólo la clave cruda, que no detecta contratos de interpolación rotos.
 *
 * Al usarse dentro de una factory de `vi.mock` (que se hoistea) hay que importarlo
 * de forma dinámica:
 *
 * vi.mock("react-i18next", async () => {
 *     const { createTranslateMock } = await import("@/test-utils/i18n");
 *     return { useTranslation: () => ({ t: createTranslateMock({ ... }) }) };
 * });
 */
export const createTranslateMock = (dictionary = {}) => {
    return (key, options) => {
        const template = dictionary[key] ?? key;

        return Object.entries(options ?? {}).reduce(
            (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, value),
            template,
        );
    };
};
