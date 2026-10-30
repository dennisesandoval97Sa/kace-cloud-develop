import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CASE_CLASSIFICATION_ID = 'classification-current';
const RECLASSIFIED_ID = 'classification-target';

const classificationsGet = vi.fn();
const fetchOneScriptData = vi.fn();
const fetchSchemasRulesBundle = vi.fn();
const casesGet = vi.fn();

let lastUpdateValue = null;
let lastSchemaProps = null;

vi.mock('#plugins/kace/components/schema/Schema.jsx', () => ({
  Schema: (props) => {
    lastUpdateValue = props.updateValue;
    lastSchemaProps = props;
    return (
      <div>
        <span>{props.component.one_script_form_id}</span>
        <pre data-testid="submission-data">
          {JSON.stringify(props.submission?.data ?? {})}
        </pre>
      </div>
    );
  },
}));

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      const services = {
        aux: { fetchSchemasRulesBundle },
        user: { get: vi.fn().mockResolvedValue({}) },
        oneScript: { fetchOneScriptData },
        cases: { get: casesGet },
        storeService: { get: vi.fn(), set: vi.fn() },
        classifications: { get: classificationsGet },
      };
      return services[name];
    },
  }),
}));

const { AuxCasesSchema } = await import('./AuxCasesSchema.jsx');

function createEventRoot() {
  const listeners = new Map();
  return {
    data: {},
    submission: { data: {} },
    on: vi.fn((name, listener) => listeners.set(name, listener)),
    off: vi.fn((name) => listeners.delete(name)),
    emit(name, value) {
      listeners.get(name)?.(value);
    },
  };
}

describe('AuxCasesSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastSchemaProps = null;
    classificationsGet.mockImplementation((_path, { classificationId }) =>
      Promise.resolve([{ one_script_id: `form-${classificationId}` }])
    );
    fetchOneScriptData.mockImplementation((formId) =>
      Promise.resolve({ schema_id: `schema-${formId}` })
    );
    fetchSchemasRulesBundle.mockResolvedValue({
      validationSchema: { data_structure: { aux_case: {} }, name: 'aux_case' },
    });
    casesGet.mockResolvedValue({
      id: 'case-1',
      clasificacion_id: CASE_CLASSIFICATION_ID,
    });
  });

  it('carga el formulario de la clasificación reclasificada antes de persistir el caso', async () => {
    const root = createEventRoot();
    render(<AuxCasesSchema component={{}} root={root} />);

    await waitFor(() => expect(root.on).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByText(`form-${CASE_CLASSIFICATION_ID}`)
      ).toBeInTheDocument()
    );

    act(() => {
      root.emit('kaceClassificationsChange', RECLASSIFIED_ID);
    });

    await waitFor(() =>
      expect(classificationsGet).toHaveBeenCalledWith(
        'classifications.classifications_groups_relationship',
        expect.objectContaining({ classificationId: RECLASSIFIED_ID })
      )
    );
    await waitFor(() =>
      expect(screen.getByText(`form-${RECLASSIFIED_ID}`)).toBeInTheDocument()
    );
  });

  it('no reutiliza los datos de la clasificación anterior al reclasificar a un formulario con distinta estructura', async () => {
    const originalKey = `data-${CASE_CLASSIFICATION_ID}`;
    const targetKey = `data-${RECLASSIFIED_ID}`;

    casesGet.mockResolvedValue({
      id: 'case-1',
      clasificacion_id: CASE_CLASSIFICATION_ID,
      aux_case: {
        data: { [originalKey]: { nombre: 'Ana', apellido: 'Perez' } },
      },
    });
    fetchSchemasRulesBundle.mockImplementation(({ schemaId }) => {
      const key =
        schemaId === `schema-form-${RECLASSIFIED_ID}` ? targetKey : originalKey;
      return Promise.resolve({
        validationSchema: { data_structure: { [key]: {} }, name: key },
      });
    });

    const root = createEventRoot();
    render(<AuxCasesSchema component={{}} root={root} />);

    await waitFor(() =>
      expect(
        screen.getByText(`form-${CASE_CLASSIFICATION_ID}`)
      ).toBeInTheDocument()
    );

    act(() => {
      root.emit('kaceClassificationsChange', RECLASSIFIED_ID);
    });

    await waitFor(() =>
      expect(screen.getByText(`form-${RECLASSIFIED_ID}`)).toBeInTheDocument()
    );

    await waitFor(() => {
      const submissionData = JSON.parse(
        screen.getByTestId('submission-data').textContent
      );
      expect(submissionData).not.toHaveProperty('apellido');
    });
  });

  it('conserva por nombre de campo los valores compatibles a través de varias reclasificaciones encadenadas (A→B→C)', async () => {
    const CLASSIFICATION_A = CASE_CLASSIFICATION_ID;
    const CLASSIFICATION_B = RECLASSIFIED_ID;
    const CLASSIFICATION_C = 'classification-final';
    const keyA = `data-${CLASSIFICATION_A}`;
    const keyB = `data-${CLASSIFICATION_B}`;
    const keyC = `data-${CLASSIFICATION_C}`;

    // A: nombre + apellido + edad (edad=43, tal como quedó guardado originalmente)
    casesGet.mockResolvedValue({
      id: 'case-1',
      clasificacion_id: CLASSIFICATION_A,
      aux_case: {
        data: { [keyA]: { nombre: 'Ana', apellido: 'Perez', edad: 43 } },
      },
    });

    const dataStructures = {
      [`schema-form-${CLASSIFICATION_A}`]: {
        [keyA]: { nombre: {}, apellido: {}, edad: {} },
      },
      // B: nombre + edad (sin apellido)
      [`schema-form-${CLASSIFICATION_B}`]: { [keyB]: { nombre: {}, edad: {} } },
      // C: edad + telefono (sin nombre)
      [`schema-form-${CLASSIFICATION_C}`]: {
        [keyC]: { edad: {}, telefono: {} },
      },
    };
    fetchSchemasRulesBundle.mockImplementation(({ schemaId }) => {
      const dataStructure = dataStructures[schemaId];
      const name = Object.keys(dataStructure)[0];
      return Promise.resolve({
        validationSchema: { data_structure: dataStructure, name },
      });
    });

    const root = createEventRoot();
    render(<AuxCasesSchema component={{}} root={root} />);

    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_A}`)).toBeInTheDocument()
    );

    // A → B: se espera conservar nombre + edad (43), perder apellido.
    act(() => {
      root.emit('kaceClassificationsChange', CLASSIFICATION_B);
    });
    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_B}`)).toBeInTheDocument()
    );
    await waitFor(() => {
      const submissionData = JSON.parse(
        screen.getByTestId('submission-data').textContent
      );
      expect(submissionData).toEqual({ nombre: 'Ana', edad: 43 });
    });

    // El agente edita `edad` mientras está en B, antes de reclasificar de nuevo.
    // La primera invocación de `updateValue` tras montar un formulario es el eco
    // inicial de Form.io (se descarta a favor del `formData` recién seteado); la
    // edición real del usuario es la siguiente.
    act(() => {
      lastUpdateValue(
        { nombre: 'Ana', edad: 43 },
        { modified: true },
        'change'
      );
    });
    act(() => {
      lastUpdateValue(
        { nombre: 'Ana', edad: 50 },
        { modified: true },
        'change'
      );
    });

    // B → C: se espera conservar edad=50 (la edición viva en B, no el 43 original de A),
    // perder nombre (C no lo tiene).
    act(() => {
      root.emit('kaceClassificationsChange', CLASSIFICATION_C);
    });
    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_C}`)).toBeInTheDocument()
    );
    await waitFor(() => {
      const submissionData = JSON.parse(
        screen.getByTestId('submission-data').textContent
      );
      expect(submissionData).toEqual({ edad: 50 });
    });
  });

  it('conserva por nombre de campo los valores de VARIAS clasificaciones ya persistidas, no solo de la que estaba visible al reclasificar', async () => {
    const CLASSIFICATION_A = CASE_CLASSIFICATION_ID;
    const CLASSIFICATION_C = 'classification-final';
    const keyA = `data-${CLASSIFICATION_A}`;
    const keyB = `data-${RECLASSIFIED_ID}`;
    const keyC = `data-${CLASSIFICATION_C}`;

    // El caso ya fue guardado dos veces antes de esta sesión: en A (nombre, apellido)
    // y luego en B (telefono). Ambas claves conviven en `aux_case.data` (merge de backend).
    casesGet.mockResolvedValue({
      id: 'case-1',
      clasificacion_id: CLASSIFICATION_A,
      aux_case: {
        data: {
          [keyA]: { nombre: 'Ana', apellido: 'Perez' },
          [keyB]: { telefono: '555-1234' },
        },
      },
    });

    const dataStructures = {
      [`schema-form-${CLASSIFICATION_A}`]: {
        [keyA]: { nombre: {}, apellido: {} },
      },
      // C: nombre + telefono, ninguna clave previa coincide exactamente con C.
      [`schema-form-${CLASSIFICATION_C}`]: {
        [keyC]: { nombre: {}, telefono: {} },
      },
    };
    fetchSchemasRulesBundle.mockImplementation(({ schemaId }) => {
      const dataStructure = dataStructures[schemaId];
      const name = Object.keys(dataStructure)[0];
      return Promise.resolve({
        validationSchema: { data_structure: dataStructure, name },
      });
    });

    const root = createEventRoot();
    render(<AuxCasesSchema component={{}} root={root} />);

    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_A}`)).toBeInTheDocument()
    );

    // A → C directamente (sesión nueva, sin edición previa en memoria): debe
    // rescatar `nombre` (de A) y `telefono` (de B) desde el `aux_case.data` persistido.
    act(() => {
      root.emit('kaceClassificationsChange', CLASSIFICATION_C);
    });
    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_C}`)).toBeInTheDocument()
    );
    await waitFor(() => {
      const submissionData = JSON.parse(
        screen.getByTestId('submission-data').textContent
      );
      expect(submissionData).toEqual({ nombre: 'Ana', telefono: '555-1234' });
    });
  });

  it('ante conflicto de nombre entre DOS clasificaciones históricas (ninguna es la visible al reclasificar), prevalece la insertada más recientemente en aux_case.data', async () => {
    const CLASSIFICATION_A = CASE_CLASSIFICATION_ID;
    const CLASSIFICATION_B = RECLASSIFIED_ID;
    const CLASSIFICATION_D = 'classification-old-2';
    const CLASSIFICATION_C = 'classification-final';
    const keyA = `data-${CLASSIFICATION_A}`;
    const keyB = `data-${CLASSIFICATION_B}`;
    const keyD = `data-${CLASSIFICATION_D}`;
    const keyC = `data-${CLASSIFICATION_C}`;

    // A (la visible al reclasificar) NO tiene `edad`, así que el carry-over de
    // sesión no puede resolver el conflicto por sí solo. B y D sí lo comparten
    // con valores distintos; D fue insertada después de B (orden de guardado).
    casesGet.mockResolvedValue({
      id: 'case-1',
      clasificacion_id: CLASSIFICATION_A,
      aux_case: {
        data: {
          [keyA]: { nombre: 'Ana' },
          [keyB]: { edad: 20 },
          [keyD]: { edad: 99 },
        },
      },
    });

    const dataStructures = {
      [`schema-form-${CLASSIFICATION_A}`]: { [keyA]: { nombre: {} } },
      [`schema-form-${CLASSIFICATION_C}`]: { [keyC]: { edad: {} } },
    };
    fetchSchemasRulesBundle.mockImplementation(({ schemaId }) => {
      const dataStructure = dataStructures[schemaId];
      const name = Object.keys(dataStructure)[0];
      return Promise.resolve({
        validationSchema: { data_structure: dataStructure, name },
      });
    });

    const root = createEventRoot();
    render(<AuxCasesSchema component={{}} root={root} />);

    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_A}`)).toBeInTheDocument()
    );

    act(() => {
      root.emit('kaceClassificationsChange', CLASSIFICATION_C);
    });
    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_C}`)).toBeInTheDocument()
    );
    await waitFor(() => {
      const submissionData = JSON.parse(
        screen.getByTestId('submission-data').textContent
      );
      expect(submissionData).toEqual({ edad: 99 });
    });
  });

  it('reclasificar de vuelta a una clasificación con match exacto restaura TODOS sus campos originales, aunque existan otras clasificaciones persistidas', async () => {
    const CLASSIFICATION_A = CASE_CLASSIFICATION_ID;
    const CLASSIFICATION_B = RECLASSIFIED_ID;
    const keyA = `data-${CLASSIFICATION_A}`;
    const keyB = `data-${CLASSIFICATION_B}`;

    casesGet.mockResolvedValue({
      id: 'case-1',
      clasificacion_id: CLASSIFICATION_A,
      aux_case: {
        data: {
          [keyA]: { nombre: 'Ana', apellido: 'Perez', edad: 43 },
          [keyB]: { telefono: '555-1234' },
        },
      },
    });

    const dataStructures = {
      [`schema-form-${CLASSIFICATION_A}`]: {
        [keyA]: { nombre: {}, apellido: {}, edad: {} },
      },
      [`schema-form-${CLASSIFICATION_B}`]: { [keyB]: { telefono: {} } },
    };
    fetchSchemasRulesBundle.mockImplementation(({ schemaId }) => {
      const dataStructure = dataStructures[schemaId];
      const name = Object.keys(dataStructure)[0];
      return Promise.resolve({
        validationSchema: { data_structure: dataStructure, name },
      });
    });

    const root = createEventRoot();
    render(<AuxCasesSchema component={{}} root={root} />);

    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_A}`)).toBeInTheDocument()
    );

    // A → B (match exacto de B, sin datos previos de B más allá de telefono)
    act(() => {
      root.emit('kaceClassificationsChange', CLASSIFICATION_B);
    });
    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_B}`)).toBeInTheDocument()
    );

    // B → A de vuelta: A tiene match exacto en aux_case.data, así que debe
    // restaurar apellido también, aunque C/B no lo compartan.
    act(() => {
      root.emit('kaceClassificationsChange', CLASSIFICATION_A);
    });
    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_A}`)).toBeInTheDocument()
    );
    await waitFor(() => {
      const submissionData = JSON.parse(
        screen.getByTestId('submission-data').textContent
      );
      expect(submissionData).toEqual({
        nombre: 'Ana',
        apellido: 'Perez',
        edad: 43,
      });
    });
  });

  it('caso nuevo sin dato persistido: solo conserva lo editado en vivo en la sesión al reclasificar encadenadamente', async () => {
    const CLASSIFICATION_A = CASE_CLASSIFICATION_ID;
    const CLASSIFICATION_B = RECLASSIFIED_ID;
    const CLASSIFICATION_C = 'classification-final';
    const keyA = `data-${CLASSIFICATION_A}`;
    const keyB = `data-${CLASSIFICATION_B}`;
    const keyC = `data-${CLASSIFICATION_C}`;

    // Caso nuevo: sin aux_case.data alguno.
    casesGet.mockResolvedValue({
      id: 'case-1',
      clasificacion_id: CLASSIFICATION_A,
    });

    const dataStructures = {
      [`schema-form-${CLASSIFICATION_A}`]: { [keyA]: { nombre: {} } },
      [`schema-form-${CLASSIFICATION_B}`]: { [keyB]: { nombre: {} } },
      [`schema-form-${CLASSIFICATION_C}`]: { [keyC]: { nombre: {} } },
    };
    fetchSchemasRulesBundle.mockImplementation(({ schemaId }) => {
      const dataStructure = dataStructures[schemaId];
      const name = Object.keys(dataStructure)[0];
      return Promise.resolve({
        validationSchema: { data_structure: dataStructure, name },
      });
    });

    const root = createEventRoot();
    render(<AuxCasesSchema component={{}} root={root} />);

    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_A}`)).toBeInTheDocument()
    );

    // El agente escribe `nombre` mientras está en A, antes de reclasificar.
    act(() => {
      lastUpdateValue({ nombre: 'Luis' }, { modified: true }, 'change');
    });
    act(() => {
      lastUpdateValue({ nombre: 'Luis' }, { modified: true }, 'change');
    });

    act(() => {
      root.emit('kaceClassificationsChange', CLASSIFICATION_B);
    });
    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_B}`)).toBeInTheDocument()
    );
    await waitFor(() => {
      const submissionData = JSON.parse(
        screen.getByTestId('submission-data').textContent
      );
      expect(submissionData).toEqual({ nombre: 'Luis' });
    });
  });

  it('una clave persistida con dato corrupto (no objeto) no rompe el merge ni contamina el resultado', async () => {
    const CLASSIFICATION_A = CASE_CLASSIFICATION_ID;
    const CLASSIFICATION_C = 'classification-final';
    const keyA = `data-${CLASSIFICATION_A}`;
    const keyB = `data-${RECLASSIFIED_ID}`;
    const keyC = `data-${CLASSIFICATION_C}`;

    casesGet.mockResolvedValue({
      id: 'case-1',
      clasificacion_id: CLASSIFICATION_A,
      aux_case: {
        data: {
          [keyA]: null,
          [keyB]: { telefono: '555-1234' },
        },
      },
    });

    const dataStructures = {
      [`schema-form-${CLASSIFICATION_A}`]: { [keyA]: { nombre: {} } },
      [`schema-form-${CLASSIFICATION_C}`]: { [keyC]: { telefono: {} } },
    };
    fetchSchemasRulesBundle.mockImplementation(({ schemaId }) => {
      const dataStructure = dataStructures[schemaId];
      const name = Object.keys(dataStructure)[0];
      return Promise.resolve({
        validationSchema: { data_structure: dataStructure, name },
      });
    });

    const root = createEventRoot();
    render(<AuxCasesSchema component={{}} root={root} />);

    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_A}`)).toBeInTheDocument()
    );

    act(() => {
      root.emit('kaceClassificationsChange', CLASSIFICATION_C);
    });
    await waitFor(() =>
      expect(screen.getByText(`form-${CLASSIFICATION_C}`)).toBeInTheDocument()
    );
    await waitFor(() => {
      const submissionData = JSON.parse(
        screen.getByTestId('submission-data').textContent
      );
      expect(submissionData).toEqual({ telefono: '555-1234' });
    });
  });

  it('pasa offEvent a Schema para no re-acumular submitButtonClicked', async () => {
    const root = createEventRoot();
    const onEvent = vi.fn();
    const offEvent = vi.fn();
    render(
      <AuxCasesSchema
        component={{}}
        root={root}
        onEvent={onEvent}
        offEvent={offEvent}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByText(`form-${CASE_CLASSIFICATION_ID}`)
      ).toBeInTheDocument()
    );
    expect(lastSchemaProps.offEvent).toBe(offEvent);
    expect(lastSchemaProps.onEvent).toBe(onEvent);
  });

  it('al reclasificar A→B fuerza refresh del schema usando el id vivo, no el del closure', async () => {
    const root = createEventRoot();
    render(<AuxCasesSchema component={{}} root={root} />);

    await waitFor(() =>
      expect(
        screen.getByText(`form-${CASE_CLASSIFICATION_ID}`)
      ).toBeInTheDocument()
    );
    fetchSchemasRulesBundle.mockClear();

    act(() => {
      root.emit('kaceClassificationsChange', RECLASSIFIED_ID);
    });

    await waitFor(() =>
      expect(fetchSchemasRulesBundle).toHaveBeenCalledWith(
        expect.objectContaining({ forceRefresh: true })
      )
    );
  });
});
