import { useLocation } from "react-router-dom";
import { isSafeInternalPath } from "@kace_v2/features/boards/utils/isSafeInternalPath.util";

export const BOARDS_LIST_ROUTE = "/boards";

/**
 * Marca el origen al abrir el formulario de un tablero, para que la flecha de volver y el
 * guardado regresen a la vista en la que estaba el usuario.
 *
 * Solo hace falta donde el origen no es el listado: sin marca, el formulario cae en el
 * fallback, que ya es `/boards`.
 *
 * @param {string} path ruta interna a la que volver.
 */
export const boardReturnStateTo = (path) => ({ state: { boardReturnTo: path } });

/**
 * Ruta de vuelta del formulario: el origen marcado por quien lo abrio, o el listado si no
 * hay ninguno (entrada directa por URL) o si no es una ruta interna.
 *
 * @param {{boardReturnTo?: string}|null} state el `location.state` de la ruta actual.
 */
export const resolveBoardFormReturn = (state) =>
    isSafeInternalPath(state?.boardReturnTo) ? state.boardReturnTo : BOARDS_LIST_ROUTE;

/**
 * No se usa `navigate(-1)`: el historial no siempre tiene detras el origen. Al crear un
 * tablero se aterriza en su vista con el formulario de alta justo detras, y volver dejaria
 * al usuario en un formulario ya enviado; abrir la edicion por enlace directo sacaria de la
 * aplicacion. El origen explicito sobrevive ademas a una recarga, porque React Router lo
 * guarda en la entrada del historial.
 *
 * @returns {string} ruta a la que debe volver el formulario.
 */
const useBoardFormReturn = () => resolveBoardFormReturn(useLocation().state);

export default useBoardFormReturn;
