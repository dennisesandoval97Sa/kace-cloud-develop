/**
 * The My Agenda header icon is visible unless the tenant explicitly turns it off.
 *
 * `isHeaderLoaded` distinguishes "tenant config not fetched yet" (render nothing,
 * like every other header flag) from "tenant saved before this setting existed"
 * (no `my_agenda` key -> keep the icon, previous behaviour).
 */
export const isMyAgendaVisible = (configHeader, isHeaderLoaded) =>
    Boolean(isHeaderLoaded) && configHeader?.my_agenda !== false;
