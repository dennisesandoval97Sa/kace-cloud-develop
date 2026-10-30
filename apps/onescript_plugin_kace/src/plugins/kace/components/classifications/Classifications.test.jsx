import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearReclassificationSession,
  markReclassificationSession,
} from '#plugins/kace/shared/reclassificationSession.js';

/**
 * El archivo completo corre en ~1,6 s, pero cada test encadena varias interacciones de
 * `userEvent` sobre un componente que se re-renderiza entero, y con el límite por defecto de
 * 5 s un tropiezo del planificador —la máquina cargada, una pausa de GC— hacía saltar el
 * timeout en un test distinto cada vez. Nunca fallaba una aserción: siempre era el reloj.
 * Se sube el margen en vez de dejar un test que pasa o falla según la carga de la máquina.
 */
vi.setConfig({ testTimeout: 15000 });

const CLASIFICACION_ACTUAL = 'clas-actual';
const CLASIFICACION_OTRA = 'clas-otra';
const GRUPO_DEL_CASO = 'grupo-del-caso';

const caseRow = {
  id: 'caso-1',
  grupo_id: GRUPO_DEL_CASO,
  clasificacion_id: CLASIFICACION_ACTUAL,
  clasificacion: {
    id: CLASIFICACION_ACTUAL,
    nivel1: 'Venta no efectiva',
    flujo_id: 'flujo-1',
  },
};

/** Catálogo completo del grupo: la actual más un destino de otro flujo. */
const catalogoCompleto = [
  {
    id: CLASIFICACION_ACTUAL,
    nivel1: 'Venta no efectiva',
    flujo_id: 'flujo-1',
  },
  { id: CLASIFICACION_OTRA, nivel1: 'Venta efectiva', flujo_id: 'flujo-2' },
];

const storeValues = {};
const fetchGroupClassification = vi.fn();
const classificationsServiceGet = vi.fn();
const fetchReclassificationPrecheck = vi.fn();

/**
 * Datos de usuario con el permiso de rol `CaseReclassify` otorgado (BUG-4). El gate combinado
 * exige el flag global Y este permiso; este archivo prueba el flag y las condiciones del caso,
 * no la resolución del permiso en sí (eso lo cubre `useReclassifyPermission.test.js`), así que
 * el permiso se otorga por defecto en todos los `beforeEach`.
 */
const userDataWithReclassifyPermission = () => ({
  permisions: {
    administrador: [{ name: 'CaseReclassify', granted: true }],
    agente: [],
  },
});

/** Handshake de la vista de administrador: el permiso se evalúa en el namespace que envía el SPA. */
const ADMIN_VIEW_HANDSHAKE = { role_namespace: 'administrador' };

/** Estados del flujo destino, en la forma `case_available_states` que responde API-3. */
const ESTADOS_DESTINO = [
  {
    transition: { id: 'trans-1' },
    estado_siguiente: { id: 'estado-9', nombre: 'Cerrado efectivo' },
  },
];

const precheckOk = {
  eligible: true,
  blocker: null,
  states: ESTADOS_DESTINO,
  transitionRules: [{ transicion_id: 'trans-1', rules: [] }],
};
/** El caso que devuelve `caseService.get('cases.case_data')`; cada test lo ajusta. */
let currentCaseRow = caseRow;

const storeSet = vi.fn((path, value) => {
  storeValues[path] = value;
});

vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: {
    get: (path) => storeValues[path],
    set: (path, value) => storeSet(path, value),
  },
}));

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'classifications') {
        return {
          get: classificationsServiceGet,
          fetchGroupClassification,
          fetchClassification: vi.fn(),
        };
      }
      if (name === 'cases') {
        return {
          // Fiel al servicio real (`caseService.js` `fetchCaseData`): sin `cases.case_id` en el
          // store, rechaza con `No case id` en vez de devolver el caso.
          get: async () => {
            if (!storeValues['cases.case_id']) throw new Error('No case id');
            return currentCaseRow;
          },
          fetchReclassificationPrecheck,
          handleErrorMessage: (error) =>
            error?.response?.data?.errors?.[0]?.message ??
            error?.message ??
            'An unexpected error occurred.',
        };
      }
      // `useReclassifyPermission` (BUG-4) resuelve el mismo `storeService` singleton vía
      // `KaceEngine().getService('storeService')`, como el resto de los componentes del plugin
      // (`Schema.jsx`, `CustomMultiselect.jsx`, ...) — no vía el import directo del módulo que
      // ya mockea este archivo para `Classifications.jsx`. Sin esta rama, `getService` devuelve
      // `null` y el gate de reclasificación queda permanentemente cerrado en los tests.
      if (name === 'storeService') {
        return {
          get: (path) => storeValues[path],
          set: (path, value) => storeSet(path, value),
        };
      }
      return null;
    },
  }),
}));

let globalFlagValue;
vi.mock('#plugins/kace/hooks/useGlobalConfig.js', async () => {
  const actual = await vi.importActual(
    '#plugins/kace/hooks/useGlobalConfig.js'
  );
  return { ...actual, useGlobalConfig: () => globalFlagValue };
});

const { Classifications } = await import('./Classifications.jsx');

afterEach(() => {
  clearReclassificationSession();
});

function renderClassifications() {
  const handleChange = vi.fn();
  const emitEvent = vi.fn();
  const result = render(
    <Classifications
      handleChange={handleChange}
      emitEvent={emitEvent}
      root={{ data: {}, submission: { data: {} }, emit: vi.fn() }}
      data={{}}
      onEvent={vi.fn()}
    />
  );
  return { ...result, handleChange, emitEvent };
}

/** Propagar `flujo_id` es lo que dispara la recarga del formulario del flujo destino. */
const propagatedFlow = (handleChange, flujoId) =>
  handleChange.mock.calls.some(
    ([key, value]) => key === 'flujo_id' && value === flujoId
  );

/**
 * Etiqueta del control habilitado. El `div` estático del control deshabilitado usa otra clase, así
 * que encontrar este texto prueba a la vez que el desplegable está abierto y qué hay elegido.
 * Antes de que resuelva `caseData` el componente renderiza la rama de creación, de donde la
 * espera por este selector —y no por `role="button"` a secas— es lo que evita un falso positivo.
 */
const enabledControlLabel = (text) =>
  screen.queryByText(text, {
    selector: '.classifications-dropdown-control-label',
  });

const disabledControl = (text) =>
  screen.queryByText(text, {
    selector: '.classifications-dropdown-control--disabled',
  });

/** Espera al estado asentado: caso cargado, catálogo resuelto y control habilitado. */
async function waitForUnlockedDropdown(selected) {
  await waitFor(() =>
    expect(enabledControlLabel(selected)).toBeInTheDocument()
  );
  return screen.getByRole('button', { expanded: false });
}

/** Elige "Venta efectiva" sin responder la confirmación de OS-7. */
async function pickOtherClassification(user) {
  await user.click(await waitForUnlockedDropdown('Venta no efectiva'));
  await user.click(
    await screen.findByRole('option', { name: 'Venta efectiva' })
  );
}

describe('Classifications — gate de reclasificación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(storeValues)) delete storeValues[key];
    currentCaseRow = caseRow;
    storeValues['cases.case_id'] = caseRow.id;
    storeValues['cases.case_data'] = caseRow;
    storeValues['user.user_data'] = userDataWithReclassifyPermission();
    storeValues['auth.handshake_params'] = ADMIN_VIEW_HANDSHAKE;
    globalFlagValue = undefined;
    fetchGroupClassification.mockResolvedValue(catalogoCompleto);
    classificationsServiceGet.mockResolvedValue([caseRow.clasificacion]);
    fetchReclassificationPrecheck.mockResolvedValue(precheckOk);
  });

  describe('gate inactivo', () => {
    it('sin el flag del tenant deja el desplegable bloqueado y no pide el catálogo', async () => {
      globalFlagValue = false;
      renderClassifications();

      await waitFor(() =>
        expect(disabledControl('Venta no efectiva')).toBeInTheDocument()
      );
      expect(enabledControlLabel('Venta no efectiva')).toBeNull();
      expect(fetchGroupClassification).not.toHaveBeenCalled();
    });
  });

  describe('gate activo', () => {
    beforeEach(() => {
      globalFlagValue = true;
    });

    it('pide el catálogo del grupo del caso, solo con clasificaciones principales', async () => {
      renderClassifications();

      await waitFor(() =>
        expect(fetchGroupClassification).toHaveBeenCalledWith(
          expect.objectContaining({
            fullCatalog: true,
            groupId: GRUPO_DEL_CASO,
          })
        )
      );
      expect(fetchGroupClassification.mock.calls[0][0]).not.toHaveProperty(
        'requireSubcaseFlow'
      );
      expect(classificationsServiceGet).not.toHaveBeenCalled();
    });

    it('desbloquea el desplegable y ofrece los destinos del catálogo', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      await user.click(await waitForUnlockedDropdown('Venta no efectiva'));

      expect(
        await screen.findByRole('option', { name: 'Venta efectiva' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: 'Venta no efectiva' })
      ).toBeInTheDocument();
    });

    it('no revierte la clasificación elegida por el asesor', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      await user.click(await waitForUnlockedDropdown('Venta no efectiva'));
      await user.click(
        await screen.findByRole('option', { name: 'Venta efectiva' })
      );

      // La re-sincronización con `caseData.clasificacion_id` correría en el render siguiente.
      await waitFor(() =>
        expect(enabledControlLabel('Venta efectiva')).toBeInTheDocument()
      );
      expect(enabledControlLabel('Venta no efectiva')).toBeNull();
    });

    it('no muestra el bloque de reclasificación mientras no cambie la clasificación', async () => {
      renderClassifications();

      await waitForUnlockedDropdown('Venta no efectiva');
      expect(screen.queryByText('Reclasificación')).toBeNull();
      expect(screen.queryByLabelText('Motivo')).toBeNull();
    });

    it('un caso cerrado sigue bloqueado', async () => {
      const cerrado = { ...caseRow, fecha_resolucion: '2026-09-01T10:00:00Z' };
      currentCaseRow = cerrado;
      storeValues['cases.case_data'] = cerrado;

      renderClassifications();

      await waitFor(() =>
        expect(disabledControl('Venta no efectiva')).toBeInTheDocument()
      );
      expect(enabledControlLabel('Venta no efectiva')).toBeNull();
      expect(fetchGroupClassification).not.toHaveBeenCalled();
    });
  });

  describe('gate activo — confirmación previa (OS-7)', () => {
    beforeEach(() => {
      globalFlagValue = true;
    });

    it('pregunta antes de reemplazar el formulario y avisa de los cambios sin guardar', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      await pickOtherClassification(user);

      // El texto se busca dentro del diálogo: "Venta efectiva" también está en el desplegable.
      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toMatch(/perderán los cambios/i);
      expect(dialog.textContent).toContain('Venta efectiva');
    });

    it('no propaga el flujo destino mientras no se confirme', async () => {
      const user = userEvent.setup({ delay: null });
      const { handleChange } = renderClassifications();

      await pickOtherClassification(user);
      await screen.findByRole('dialog');

      expect(propagatedFlow(handleChange, 'flujo-2')).toBe(false);
      expect(
        handleChange.mock.calls.some(
          ([key, value]) =>
            key === 'clasificacion_id' && value === CLASIFICACION_OTRA
        )
      ).toBe(false);
    });

    it('al confirmar propaga el flujo destino y cierra el diálogo', async () => {
      const user = userEvent.setup({ delay: null });
      const { handleChange } = renderClassifications();

      await pickOtherClassification(user);
      await user.click(
        await screen.findByRole('button', { name: 'Continuar' })
      );

      await waitFor(() =>
        expect(propagatedFlow(handleChange, 'flujo-2')).toBe(true)
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(storeValues['aux_case.hasSchema']).toBe(false);
    });

    it('al cancelar restaura la clasificación del caso sin tocar el formulario', async () => {
      const user = userEvent.setup({ delay: null });
      const { handleChange } = renderClassifications();

      await pickOtherClassification(user);
      await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

      await waitFor(() =>
        expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(propagatedFlow(handleChange, 'flujo-2')).toBe(false);
      // La rama de limpieza del efecto emitiría esto y recargaría el formulario.
      expect(
        handleChange.mock.calls.some(
          ([key, value]) => key === 'clasificacion_id' && value === null
        )
      ).toBe(false);
    });

    it('tras cancelar, volver a elegir el mismo destino pregunta de nuevo', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      await pickOtherClassification(user);
      await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
      await waitFor(() =>
        expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
      );

      await pickOtherClassification(user);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('sin el gate la selección propaga directo, sin diálogo', async () => {
      const user = userEvent.setup({ delay: null });
      globalFlagValue = false;
      // Caso sin clasificar: el desplegable está abierto por creación, no por el gate. La carga va
      // por el magic getter del servicio, no por `fetchGroupClassification`.
      currentCaseRow = { id: 'caso-1', grupo_id: GRUPO_DEL_CASO };
      storeValues['cases.case_data'] = currentCaseRow;
      classificationsServiceGet.mockResolvedValue(catalogoCompleto);

      const { handleChange } = renderClassifications();

      await user.click(await waitForUnlockedDropdown('Elige una opción'));
      await user.click(
        await screen.findByRole('option', { name: 'Venta efectiva' })
      );

      await waitFor(() =>
        expect(propagatedFlow(handleChange, 'flujo-2')).toBe(true)
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    /**
     * El diálogo declara `aria-modal`, así que tiene que comportarse como modal: el formulario
     * de detrás sigue en el DOM y sin trampa de foco el tabulador se escapa a él.
     */
    describe('accesibilidad del diálogo', () => {
      it('lleva el foco a la acción principal al abrirse', async () => {
        const user = userEvent.setup();
        renderClassifications();

        await pickOtherClassification(user);

        const confirm = await screen.findByRole('button', {
          name: 'Continuar',
        });
        expect(confirm).toHaveFocus();
      });

      it('cancela con Escape', async () => {
        const user = userEvent.setup();
        const { handleChange } = renderClassifications();

        await pickOtherClassification(user);
        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(propagatedFlow(handleChange, 'flujo-2')).toBe(false);
      });

      it('el tabulador no sale del diálogo', async () => {
        const user = userEvent.setup();
        renderClassifications();

        await pickOtherClassification(user);
        const dialog = await screen.findByRole('dialog');

        // Desde el último foco (Continuar), tabular vuelve al primero en vez de irse al
        // formulario de detrás.
        await user.tab();
        expect(dialog).toContainElement(document.activeElement);

        await user.tab({ shift: true });
        expect(dialog).toContainElement(document.activeElement);
      });
    });
  });

  describe('gate activo — precheck (OS-8)', () => {
    beforeEach(() => {
      globalFlagValue = true;
    });

    it('consulta el precheck del caso y el destino al confirmar', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      await pickOtherClassification(user);
      expect(fetchReclassificationPrecheck).not.toHaveBeenCalled();

      await user.click(
        await screen.findByRole('button', { name: 'Continuar' })
      );

      await waitFor(() =>
        expect(fetchReclassificationPrecheck).toHaveBeenCalledWith({
          caseId: caseRow.id,
          clasificacionId: CLASIFICACION_OTRA,
        })
      );
    });

    it('con el precheck OK emite el evento con los estados del flujo destino', async () => {
      const user = userEvent.setup({ delay: null });
      const { emitEvent } = renderClassifications();

      await pickOtherClassification(user);
      await user.click(
        await screen.findByRole('button', { name: 'Continuar' })
      );

      await waitFor(() =>
        expect(emitEvent).toHaveBeenCalledWith(
          'kaceCaseReclassified',
          expect.objectContaining({
            clasificacion_id: CLASIFICACION_OTRA,
            flujo_id: 'flujo-2',
            states: ESTADOS_DESTINO,
          })
        )
      );
      expect(
        storeValues['classifications.reclassification_precheck']
      ).toMatchObject({ clasificacion_id: CLASIFICACION_OTRA });
    });

    it('un destino no elegible muestra el motivo del backend y no propaga', async () => {
      const user = userEvent.setup({ delay: null });
      fetchReclassificationPrecheck.mockResolvedValue({
        eligible: false,
        blocker: {
          code: '0x030057',
          message: 'The target classification is not active.',
        },
        states: [],
        transitionRules: [],
      });
      const { handleChange, emitEvent } = renderClassifications();

      await pickOtherClassification(user);
      await user.click(
        await screen.findByRole('button', { name: 'Continuar' })
      );

      expect(
        await screen.findByText('La clasificación seleccionada está inactiva.')
      ).toBeInTheDocument();
      expect(propagatedFlow(handleChange, 'flujo-2')).toBe(false);
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it('cerrar tras un bloqueo restaura la clasificación del caso', async () => {
      const user = userEvent.setup({ delay: null });
      fetchReclassificationPrecheck.mockResolvedValue({
        eligible: false,
        blocker: { message: 'El caso tiene subcasos activos' },
        states: [],
        transitionRules: [],
      });
      renderClassifications();

      await pickOtherClassification(user);
      await user.click(
        await screen.findByRole('button', { name: 'Continuar' })
      );
      await user.click(await screen.findByRole('button', { name: 'Cerrar' }));

      await waitFor(() =>
        expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('un fallo de la llamada muestra el mensaje del backend y no propaga', async () => {
      const user = userEvent.setup({ delay: null });
      fetchReclassificationPrecheck.mockRejectedValue({
        response: {
          data: { errors: [{ message: 'No tiene permiso para reclasificar' }] },
        },
      });
      const { handleChange } = renderClassifications();

      await pickOtherClassification(user);
      await user.click(
        await screen.findByRole('button', { name: 'Continuar' })
      );

      expect(
        await screen.findByText('No tiene permiso para reclasificar')
      ).toBeInTheDocument();
      expect(propagatedFlow(handleChange, 'flujo-2')).toBe(false);
    });

    it('descarta la respuesta de un precheck que quedó obsoleto', async () => {
      const user = userEvent.setup({ delay: null });
      let resolveLento;
      fetchReclassificationPrecheck.mockReturnValue(
        new Promise((resolve) => {
          resolveLento = resolve;
        })
      );
      const { handleChange, emitEvent } = renderClassifications();

      await pickOtherClassification(user);
      await user.click(
        await screen.findByRole('button', { name: 'Continuar' })
      );
      // El asesor se arrepiente mientras el precheck sigue en vuelo.
      await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

      resolveLento(precheckOk);

      await waitFor(() =>
        expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
      );
      expect(emitEvent).not.toHaveBeenCalled();
      expect(propagatedFlow(handleChange, 'flujo-2')).toBe(false);
    });
  });

  describe('gate activo — rótulo y motivo (OS-6)', () => {
    beforeEach(() => {
      globalFlagValue = true;
    });

    /** Elige "Venta efectiva" y acepta la confirmación de OS-7, que es lo que abre el motivo. */
    async function selectOtherClassification(user) {
      await pickOtherClassification(user);
      await user.click(
        await screen.findByRole('button', { name: 'Continuar' })
      );
      return screen.findByLabelText('Motivo');
    }

    /**
     * Escribe el motivo y sale del campo.
     *
     * Salir es lo que adelanta la escritura al store, así que el test no depende de que
     * transcurra la pausa de tecleo: esperar tiempo real es justo lo que vuelve frágil a un
     * test de UI —pasa o falla según lo cargada que esté la máquina—.
     */
    async function writeReason(user, textarea, reason) {
      await user.click(textarea);
      // `paste` y no `type`: un motivo realista son decenas de pulsaciones, y cada una
      // re-renderiza el componente entero hasta desbordar el timeout del test.
      await user.paste(reason);
      await user.tab();
    }

    it('muestra el rótulo y el motivo al elegir otra clasificación', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      const textarea = await selectOtherClassification(user);

      expect(screen.getByText('Reclasificación')).toBeInTheDocument();
      expect(textarea).toHaveAttribute('maxlength', '500');
      expect(screen.getByText('0/500')).toBeInTheDocument();
    });

    it('publica el motivo en el store para el guardado de OS-11', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      const textarea = await selectOtherClassification(user);
      await writeReason(user, textarea, 'El cliente sí cerró la venta');

      expect(storeValues['classifications.reclassification_reason']).toBe(
        'El cliente sí cerró la venta'
      );
    });

    it('avisa del mínimo del backend sin llegar a publicar el motivo', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      const textarea = await selectOtherClassification(user);
      await writeReason(user, textarea, 'ab');

      expect(
        screen.getByText(
          'El motivo de la reclasificación debe tener al menos 3 caracteres.'
        )
      ).toBeInTheDocument();
      expect(storeValues['classifications.reclassification_reason']).toBe('ab');
    });

    /**
     * BUG (reporte 2026-09-22, Andrés): un debounce escribía el motivo al store con retraso.
     * OS-11 puede leerlo antes de que se asiente —reclasificaciones hechas una detrás de otra,
     * con segundos de diferencia entre el tecleo y "Guardar"— y la reclasificación quedaba
     * escrita SIN motivo pese a que el asesor sí escribió uno. Ahora se escribe sin demora en
     * cada cambio, sin depender de una pausa ni de `onBlur`.
     */
    it('publica el motivo en el store sin demora, sin esperar una pausa de tecleo', async () => {
      const user = userEvent.setup();
      renderClassifications();

      const textarea = await selectOtherClassification(user);
      await user.click(textarea);
      await user.type(textarea, 'hola');

      expect(storeValues['classifications.reclassification_reason']).toBe(
        'hola'
      );
    });

    /** Salir del campo adelanta la escritura: el asesor pulsa guardar justo después. */
    it('publica el motivo al salir del campo, sin esperar la pausa', async () => {
      const user = userEvent.setup();
      renderClassifications();

      const textarea = await selectOtherClassification(user);
      await user.click(textarea);
      await user.paste('Motivo listo para guardar');
      storeSet.mockClear();
      await user.tab();

      expect(storeSet).toHaveBeenCalledWith(
        'classifications.reclassification_reason',
        'Motivo listo para guardar'
      );
    });

    it('deja de avisar a partir del tercer caracter', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      const textarea = await selectOtherClassification(user);
      await writeReason(user, textarea, 'abc');

      expect(
        screen.queryByText(
          'El motivo de la reclasificación debe tener al menos 3 caracteres.'
        )
      ).toBeNull();
    });

    it('descarta el motivo al volver a la clasificación original', async () => {
      const user = userEvent.setup({ delay: null });
      renderClassifications();

      const textarea = await selectOtherClassification(user);
      await user.click(textarea);
      await user.paste('Motivo que ya no aplica');

      await user.click(screen.getByRole('button', { expanded: false }));
      await user.click(
        await screen.findByRole('option', { name: 'Venta no efectiva' })
      );

      await waitFor(() => expect(screen.queryByLabelText('Motivo')).toBeNull());
      expect(storeValues['classifications.reclassification_reason']).toBeNull();
    });
  });
});

/**
 * MSKT-1392 ronda 2 — las dos carreras que el review encontró.
 */
describe('Classifications — reclasificación abandonada y flag tardío', () => {
  const PRECHECK_PATH = 'classifications.reclassification_precheck';
  const REASON_PATH = 'classifications.reclassification_reason';

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(storeValues)) delete storeValues[key];
    currentCaseRow = caseRow;
    storeValues['cases.case_id'] = caseRow.id;
    storeValues['cases.case_data'] = caseRow;
    storeValues['user.user_data'] = userDataWithReclassifyPermission();
    storeValues['auth.handshake_params'] = ADMIN_VIEW_HANDSHAKE;
    globalFlagValue = true;
    fetchGroupClassification.mockResolvedValue(catalogoCompleto);
    classificationsServiceGet.mockResolvedValue([caseRow.clasificacion]);
    fetchReclassificationPrecheck.mockResolvedValue(precheckOk);
  });

  /**
   * El marcador sobrevive en localStorage a cerrar la pestaña. Al reabrir el caso, la UI ya
   * volvió a la clasificación original; si el marcador siguiera vivo, `custom-submit` abortaría
   * todos los guardados posteriores pidiendo un estado que este montaje ya no tiene.
   */
  /**
   * Confirmar recarga el formulario destino y este componente se monta de nuevo. La sesión
   * en memoria es lo que distingue ese remount de "volví días después": hay que restaurar
   * el destino y el motivo, no tratarlos como un precheck huérfano.
   */
  it('tras remountar con la sesión viva restaura el destino y conserva el motivo', async () => {
    storeValues[PRECHECK_PATH] = {
      case_id: caseRow.id,
      clasificacion_id: CLASIFICACION_OTRA,
      states: ESTADOS_DESTINO,
      transition_rules: [],
    };
    storeValues[REASON_PATH] = 'Venta confirmada';
    markReclassificationSession(caseRow.id, CLASIFICACION_OTRA);

    renderClassifications();

    await waitFor(() =>
      expect(enabledControlLabel('Venta efectiva')).toBeInTheDocument()
    );
    expect(storeValues[PRECHECK_PATH]).toMatchObject({
      clasificacion_id: CLASIFICACION_OTRA,
    });
    expect(storeValues[REASON_PATH]).toBe('Venta confirmada');
    expect(screen.getByLabelText(/Motivo/)).toHaveValue('Venta confirmada');
  });

  it('limpia el precheck que quedó vivo de una confirmación que nunca se guardó', async () => {
    storeValues[PRECHECK_PATH] = {
      case_id: caseRow.id,
      clasificacion_id: CLASIFICACION_OTRA,
      states: ESTADOS_DESTINO,
      transition_rules: [],
    };
    storeValues[REASON_PATH] = 'Motivo que se quedó a medias';

    renderClassifications();

    await waitFor(() => expect(storeValues[PRECHECK_PATH]).toBeNull());
    expect(storeValues[REASON_PATH]).toBeNull();
  });

  it('no toca el precheck de otro caso: lo descarta su propio dueño', async () => {
    const ajeno = {
      case_id: 'otro-caso',
      clasificacion_id: CLASIFICACION_OTRA,
      states: [],
      transition_rules: [],
    };
    storeValues[PRECHECK_PATH] = ajeno;

    renderClassifications();

    await waitFor(() =>
      expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
    );
    expect(storeValues[PRECHECK_PATH]).toEqual(ajeno);
  });

  it('no borra el precheck que el asesor acaba de confirmar en esta sesión', async () => {
    const user = userEvent.setup({ delay: null });
    renderClassifications();

    await pickOtherClassification(user);
    await user.click(await screen.findByRole('button', { name: 'Continuar' }));

    await waitFor(() =>
      expect(storeValues[PRECHECK_PATH]).toMatchObject({
        case_id: caseRow.id,
        clasificacion_id: CLASIFICACION_OTRA,
      })
    );
  });

  /**
   * El flag del tenant puede resolver DESPUÉS de haber lanzado la carga restringida. Sin
   * abandonar la petición en vuelo, `ensureLoaded()` devolvía esa misma promesa vieja y el
   * asesor nunca veía el catálogo completo aunque el flag ya lo permitiera.
   */
  it('recarga el catálogo completo cuando el flag llega con el fetch restringido en vuelo', async () => {
    globalFlagValue = false;
    // Sin `clasificacion` embebida: con ella el camino bloqueado usa el atajo local y no llega a
    // pedir nada, que es justo lo contrario de la carrera que se quiere reproducir.
    const { clasificacion: _embedded, ...caseSinEmbebida } = caseRow;
    currentCaseRow = caseSinEmbebida;
    storeValues['cases.case_data'] = caseSinEmbebida;
    let resolveRestringido;
    classificationsServiceGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRestringido = resolve;
        })
    );

    const { rerender } = render(
      <Classifications
        handleChange={vi.fn()}
        emitEvent={vi.fn()}
        root={{ data: {}, submission: { data: {} }, emit: vi.fn() }}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    await waitFor(() => expect(classificationsServiceGet).toHaveBeenCalled());
    expect(fetchGroupClassification).not.toHaveBeenCalled();

    globalFlagValue = true;
    rerender(
      <Classifications
        handleChange={vi.fn()}
        emitEvent={vi.fn()}
        root={{ data: {}, submission: { data: {} }, emit: vi.fn() }}
        data={{}}
        onEvent={vi.fn()}
      />
    );

    // La carga completa arranca DETRÁS de la restringida, no a la vez: dos `loadFn` en paralelo
    // dejan que gane la que resuelva última y el `setOptions` de la vieja puede quedar encima.
    expect(fetchGroupClassification).not.toHaveBeenCalled();

    // La respuesta restringida llega TARDE: ya no describe el catálogo vigente y no debe pisar
    // al completo.
    resolveRestringido?.([caseRow.clasificacion]);

    await waitFor(() => expect(fetchGroupClassification).toHaveBeenCalled());
    await waitFor(() =>
      expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
    );
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { expanded: false }));
    expect(
      await screen.findByRole('option', { name: 'Venta efectiva' })
    ).toBeInTheDocument();
  });

  /**
   * El mismo relevo, pero la carga abandonada termina en ERROR. Su `catch`/`finally` corre
   * igualmente: no puede apagar el spinner de la carga vigente ni vaciar el catálogo que esa
   * carga acaba de dejar en pantalla.
   */
  it('una carga abandonada que falla no vacía el catálogo ni apaga el spinner de la vigente', async () => {
    globalFlagValue = false;
    const { clasificacion: _embedded, ...caseSinEmbebida } = caseRow;
    currentCaseRow = caseSinEmbebida;
    storeValues['cases.case_data'] = caseSinEmbebida;
    let rejectRestringido;
    classificationsServiceGet.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRestringido = reject;
        })
    );

    const props = {
      handleChange: vi.fn(),
      emitEvent: vi.fn(),
      root: { data: {}, submission: { data: {} }, emit: vi.fn() },
      data: {},
      onEvent: vi.fn(),
    };
    const { rerender } = render(<Classifications {...props} />);

    await waitFor(() => expect(classificationsServiceGet).toHaveBeenCalled());

    globalFlagValue = true;
    rerender(<Classifications {...props} />);

    rejectRestringido?.(new Error('la carga restringida falló'));

    await waitFor(() => expect(fetchGroupClassification).toHaveBeenCalled());
    await waitFor(() =>
      expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
    );
    expect(screen.queryByText('Cargando...')).not.toBeInTheDocument();

    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { expanded: false }));
    expect(
      await screen.findByRole('option', { name: 'Venta efectiva' })
    ).toBeInTheDocument();
  });
});

/**
 * Hallazgo de la segunda revisión (MSKT-1392 ronda 2): el precheck GUARDADO sobrevivía a cambiar
 * de destino tras confirmar, y OS-11 lo lee del store al guardar. El caso acababa reclasificado a
 * un destino que el asesor abandonó, sin nada en pantalla que lo anunciara.
 */
describe('Classifications — el precheck confirmado no sobrevive a cambiar de destino', () => {
  const PRECHECK_PATH = 'classifications.reclassification_precheck';

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(storeValues)) delete storeValues[key];
    currentCaseRow = caseRow;
    storeValues['cases.case_id'] = caseRow.id;
    storeValues['cases.case_data'] = caseRow;
    storeValues['user.user_data'] = userDataWithReclassifyPermission();
    storeValues['auth.handshake_params'] = ADMIN_VIEW_HANDSHAKE;
    globalFlagValue = true;
    fetchGroupClassification.mockResolvedValue(catalogoCompleto);
    classificationsServiceGet.mockResolvedValue([caseRow.clasificacion]);
    fetchReclassificationPrecheck.mockResolvedValue(precheckOk);
  });

  it('descarta el precheck al volver a la clasificación original tras haber confirmado otra', async () => {
    const user = userEvent.setup({ delay: null });
    renderClassifications();

    await pickOtherClassification(user);
    await user.click(await screen.findByRole('button', { name: 'Continuar' }));
    await waitFor(() =>
      expect(storeValues[PRECHECK_PATH]).toMatchObject({
        clasificacion_id: CLASIFICACION_OTRA,
      })
    );

    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(
      await screen.findByRole('option', { name: 'Venta no efectiva' })
    );

    await waitFor(() => expect(storeValues[PRECHECK_PATH]).toBeNull());
  });
});

/**
 * Misma fuga que se corrigió en `useStates`: `classifications/index.js` pasa
 * `onEvent: this.on.bind(this)` y lo re-crea en cada `renderReactComponent()` —que `setDisabled()`
 * dispara en cada redibujado del formulario—. El emisor real (`Element.on`) apila, así que sin
 * `offEvent` cada redibujado deja otra suscripción viva sobre el emisor compartido de Form.io.
 */
describe('Classifications — suscripción a los eventos del componente', () => {
  /** Emisor con la semántica de `Element.on`/`Element.off`: apila y da de baja por identidad. */
  const createEmitter = () => {
    const registry = new Map();
    return {
      count: (name) => registry.get(name)?.length ?? 0,
      on: (name, handler) => {
        if (!registry.has(name)) registry.set(name, []);
        registry.get(name).push(handler);
      },
      off: (name, handler) => {
        const handlers = registry.get(name);
        if (!handlers) return;
        const index = handlers.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      },
    };
  };

  /**
   * `kaceAuthData` tiene DOS suscriptores propios: el efecto de `Classifications.jsx` y
   * `useReclassifyPermission` (BUG-4), cada uno con su propia limpieza — de ahí el 2 esperado en
   * vez de 1. `redraw` y `resetForm` solo los usa el efecto del componente.
   */
  const SUSCRIPCIONES_ESPERADAS = {
    kaceAuthData: 2,
    redraw: 1,
    resetForm: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(storeValues)) delete storeValues[key];
    currentCaseRow = caseRow;
    storeValues['cases.case_id'] = caseRow.id;
    storeValues['cases.case_data'] = caseRow;
    storeValues['user.user_data'] = userDataWithReclassifyPermission();
    storeValues['auth.handshake_params'] = ADMIN_VIEW_HANDSHAKE;
    globalFlagValue = true;
    fetchGroupClassification.mockResolvedValue(catalogoCompleto);
    classificationsServiceGet.mockResolvedValue([caseRow.clasificacion]);
  });

  /** Cada render recibe enlaces nuevos, igual que `this.on.bind(this)` en producción. */
  const propsWith = (emitter) => ({
    handleChange: vi.fn(),
    emitEvent: vi.fn(),
    root: { data: {}, submission: { data: {} }, emit: vi.fn() },
    data: {},
    onEvent: (name, handler) => emitter.on(name, handler),
    offEvent: (name, handler) => emitter.off(name, handler),
  });

  it('deja una sola suscripción por evento aunque el componente se redibuje', async () => {
    const emitter = createEmitter();
    const { rerender } = render(<Classifications {...propsWith(emitter)} />);

    await waitFor(() =>
      expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
    );
    rerender(<Classifications {...propsWith(emitter)} />);
    rerender(<Classifications {...propsWith(emitter)} />);
    rerender(<Classifications {...propsWith(emitter)} />);

    for (const [evento, esperadas] of Object.entries(SUSCRIPCIONES_ESPERADAS)) {
      expect(emitter.count(evento)).toBe(esperadas);
    }
  });

  it('se da de baja al desmontar, sin dejar nada colgando del emisor compartido', async () => {
    const emitter = createEmitter();
    const { unmount } = render(<Classifications {...propsWith(emitter)} />);

    await waitFor(() =>
      expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
    );
    unmount();

    for (const evento of Object.keys(SUSCRIPCIONES_ESPERADAS)) {
      expect(emitter.count(evento)).toBe(0);
    }
  });

  /**
   * `offEvent` es opcional a propósito: un consumidor que no lo pase debe seguir funcionando
   * —volverá a fugar, pero no puede romper—.
   */
  it('no revienta cuando el consumidor no aporta baja de listener', async () => {
    const emitter = createEmitter();
    const { offEvent: _sin, ...props } = propsWith(emitter);

    const { unmount } = render(<Classifications {...props} />);
    await waitFor(() =>
      expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
    );

    expect(() => unmount()).not.toThrow();
  });
});

/**
 * `cases.case_id` lo escribe el handshake `kaceAuthData` (`Auth.jsx`), que es asíncrono: si
 * `Classifications` monta antes de que resuelva, `caseService.get` rechazaría con `No case id`.
 * Sin reintento, `caseData` se quedaba en `null` para siempre y el caso se trataba como creación
 * en vez de edición —el desplegable nunca llegaba a evaluar el gate de reclasificación—.
 */
describe('Classifications — reintenta traer el caso cuando cases.case_id resuelve tarde', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(storeValues)) delete storeValues[key];
    currentCaseRow = caseRow;
    // Deliberadamente sin `cases.case_id`: simula que el handshake de Auth no resolvió todavía.
    globalFlagValue = true;
    fetchGroupClassification.mockResolvedValue(catalogoCompleto);
    classificationsServiceGet.mockResolvedValue([caseRow.clasificacion]);
    fetchReclassificationPrecheck.mockResolvedValue(precheckOk);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('no queda bloqueado para siempre: reintenta en kaceAuthData y desbloquea el caso ya clasificado', async () => {
    // `Classifications`, `useGlobalConfig` (flag) y `useReclassifyPermission` (permiso) se
    // suscriben cada uno a `kaceAuthData` por su cuenta: hay que simular las TRES, no solo la
    // última en registrarse.
    const authHandlers = [];
    const onEvent = vi.fn((name, handler) => {
      if (name === 'kaceAuthData') authHandlers.push(handler);
    });
    const fireAuthResolved = () => authHandlers.forEach((handler) => handler());

    render(
      <Classifications
        handleChange={vi.fn()}
        emitEvent={vi.fn()}
        root={{ data: {}, submission: { data: {} }, emit: vi.fn() }}
        data={{}}
        onEvent={onEvent}
      />
    );

    /**
     * Primer intento: sin `case_id` todavía, el componente NO llama a `caseService.get` —es una
     * llamada condenada a fallar en el camino común (toda carrera de montaje, y también la
     * creación genuina de un caso nuevo)— así que no hay nada que mostrar y tampoco un
     * `console.error` de producción por una falla esperada.
     */
    await waitFor(() =>
      expect(enabledControlLabel('Elige una opción')).toBeInTheDocument()
    );
    expect(console.error).not.toHaveBeenCalled();
    expect(disabledControl('Venta no efectiva')).toBeNull();

    // Auth resuelve: el handshake setea `case_id` y `user_data`, y dispara `kaceAuthData`, igual
    // que en producción.
    storeValues['cases.case_id'] = caseRow.id;
    storeValues['user.user_data'] = userDataWithReclassifyPermission();
    storeValues['auth.handshake_params'] = ADMIN_VIEW_HANDSHAKE;
    fireAuthResolved();

    await waitFor(() =>
      expect(enabledControlLabel('Venta no efectiva')).toBeInTheDocument()
    );
  });
});
