import { expect } from "@playwright/test";

import { selectAdministratorGroupIfPrompted } from "./group-selection";

/**
 * Trigger del menú de usuario (DropdownMenu de Radix), montado en SubMenuBar dentro de
 * MainLayout para cualquier ruta autenticada. GeneralSetupProvider
 * (src/components/layouts/GeneralSetupProvider.jsx) reemplaza TODO el árbol de rutas -incluido
 * MainLayout- por una pantalla de carga, un error o el selector de grupo mientras
 * !isAuthenticated || isLoadingUserInformation || !configAdmin, así que este testid solo puede
 * estar visible una vez la app real (no un sustituto de login) se montó. Por eso también sirve
 * como marcador de shell autenticado, además de como trigger de tryOpenUserMenu.
 *
 * @radix-ui/react-dropdown-menu no importa react-remove-scroll directamente, pero delega el
 * render de su contenido en @radix-ui/react-menu (dependencia transitiva), cuya rama
 * MenuRootContentModal -la que se usa por defecto, con modal=true, y popover-menu-user.jsx no
 * lo sobreescribe- pone disableOutsideScroll:true y envuelve el contenido en RemoveScroll.
 * O sea que este menú SÍ dispara react-remove-scroll al abrirse.
 */
const AUTHENTICATED_SHELL_TESTID = "popover_menu_user_trigger";

/**
 * Falla de forma distinguible si, tras navegar a `route`, no llegamos al shell autenticado.
 *
 * Esta comprobación se ejecuta SIEMPRE, en modo exploratorio y en modo CSP_STRICT por igual:
 * una sesión de `.auth/user.json` caducada (o una ruta que redirige a login) no es un resultado
 * de la medición de violaciones CSP, es que la medición no llegó a ocurrir. Dejarla pasar en
 * silencio produciría un informe "limpio" que en realidad no ejerció ninguna pantalla real.
 */
export const assertAuthenticatedShell = async (page, route) => {
    await selectAdministratorGroupIfPrompted(page, { timeout: 2_000 });

    await expect(
        page.getByTestId(AUTHENTICATED_SHELL_TESTID),
        `[csp-violations] La ruta "${route}" no llegó al shell autenticado (sesión caducada o redirección a login). ` +
            "Vuelve a correr `pnpm run e2e:auth` para regenerar .auth/user.json y reintenta.",
    ).toBeVisible({ timeout: 20_000 });
};

/**
 * Intenta abrir el primer Radix Select visible en la página (role="combobox" es el marcador
 * estable de @radix-ui/react-select, con independencia de qué wrapper de formulario lo use).
 * @radix-ui/react-select usa react-remove-scroll directamente, así que es una vía para
 * disparar esa hipótesis de style-src-elem fuera del drawer de agenda.
 *
 * Paso opcional: si la ruta no tiene ningún combobox, se salta sin fallar. El resultado
 * (opened/skipped/error) se registra para que un salto no quede como cobertura silenciosa.
 * Complementa a tryOpenUserMenu (más abajo), que cubre la misma hipótesis por otra vía
 * de forma garantizada en cualquier ruta.
 */
export const tryOpenFirstSelect = async (page) => {
    const step = "open-select";
    const trigger = page.locator('[role="combobox"]:visible').first();

    const appeared = await trigger
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => true)
        .catch(() => false);

    if (!appeared) return { step, outcome: "skipped", reason: "no combobox visible on page" };

    try {
        await trigger.click({ timeout: 3_000 });
        await page.locator('[role="listbox"]').first().waitFor({ state: "visible", timeout: 3_000 });
        await page.keyboard.press("Escape");
        return { step, outcome: "opened" };
    } catch (error) {
        return { step, outcome: "error", reason: error.message };
    }
};

/**
 * Abre el drawer "Mi agenda" (solo existe en /agent, montado desde MainLayout vía
 * src/components/core/MyAgenda/MyAgenda.jsx). Cubre las dos hipótesis de una vez:
 * monta FullCalendar dentro, y el propio Drawer de vaul usa @radix-ui/react-dialog
 * por debajo -> react-remove-scroll también se dispara aquí.
 *
 * OJO selector: el botón (src/components/layouts/SubMenuBar.jsx:78-84) tiene el atributo
 * `datta-testid` mal escrito en el JSX de producción (dos "t"), así que NO se puede localizar
 * por testid. Se localiza por `id`, que sí está bien escrito. No se corrige la errata aquí:
 * es código de src/ ajeno a esta tarea.
 *
 * Paso opcional: solo aplica a /agent; en cualquier otra ruta el botón no existe y se salta.
 */
export const tryOpenAgentDiaryDrawer = async (page) => {
    const step = "open-agenda-drawer";
    const trigger = page.locator("#btn_sub_menu_diary");

    const appeared = await trigger
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => true)
        .catch(() => false);

    if (!appeared) return { step, outcome: "skipped", reason: "diary button not present on this route" };

    try {
        await trigger.click({ timeout: 3_000 });
        // La propia raíz <Drawer> (vaul) no reenvía su id/data-testid al DOM (destructura props
        // nombradas sin ...rest), así que el marcador determinista es el de <DrawerContent>, que
        // sí llega al DOM porque @radix-ui/react-dialog reenvía sus props con ...rest.
        await page.getByTestId("my_agenda_drawer_content").waitFor({ state: "visible", timeout: 5_000 });
        return { step, outcome: "opened" };
    } catch (error) {
        return { step, outcome: "error", reason: error.message };
    }
};

/**
 * Abre y cierra el menú de usuario (DropdownMenu de Radix, trigger `popover_menu_user_trigger`,
 * ver el comentario de AUTHENTICATED_SHELL_TESTID más arriba para la evidencia de por qué esto
 * dispara react-remove-scroll). A diferencia de tryOpenFirstSelect, esta superficie está
 * garantizada en las 14 rutas: es el mismo trigger que assertAuthenticatedShell ya exige visible
 * antes de llamar a esta función, así que aquí no hace falta una rama "skipped" por ausencia.
 */
export const tryOpenUserMenu = async (page) => {
    const step = "open-user-menu";
    const trigger = page.getByTestId(AUTHENTICATED_SHELL_TESTID);

    try {
        await trigger.click({ timeout: 3_000 });
        // DropdownMenuContent porta a un Portal; role="menu" es el marcador estable de Radix.
        await page.locator('[role="menu"]').first().waitFor({ state: "visible", timeout: 3_000 });
        await page.keyboard.press("Escape");
        return { step, outcome: "opened" };
    } catch (error) {
        return { step, outcome: "error", reason: error.message };
    }
};
