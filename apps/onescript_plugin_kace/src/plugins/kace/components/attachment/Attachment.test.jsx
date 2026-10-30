import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Attachment } from './Attachment.jsx';

const storeGet = vi.fn();
const storeSet = vi.fn();

vi.mock('#plugins/kace/hooks/useEventData.js', () => ({
  default: vi.fn(() => ({
    data: {},
    attachmentsLoading: false,
    error: null,
  })),
}));

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'storeService') {
        return { get: storeGet, set: storeSet };
      }
      if (name === 'user') {
        return { canEditCaseSync: () => true };
      }
      if (name === 'file') {
        return { deleteFile: vi.fn(), downloadFile: vi.fn() };
      }
      return null;
    },
  }),
}));

function renderAttachment() {
  return render(
    <Attachment
      onEvent={vi.fn()}
      component={{
        classificationMode: 'tipoAdjunto',
        attachmentTypes: [
          { label: 'Recepción', identifier: 1 },
          { label: 'Envío', identifier: 2 },
        ],
      }}
    />
  );
}

function mockBaseStoreValues(overrides = {}) {
  storeGet.mockImplementation((key) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      return overrides[key];
    }
    if (key === 'config.global_config') {
      return {
        behaviors: {
          application: {
            agente: {
              files_extensions: {
                maximun_size_allowed: 5,
                quantity_files_allowed: 0,
                allowed_file_extensions: ['.jpg'],
              },
            },
          },
        },
      };
    }
    if (key === 'config.cases_config') {
      return { allow_client_send_attachments: true };
    }
    if (key === 'cases.generated_case_id') {
      return 'generated-case-id';
    }
    return null;
  });
}

describe('Legacy forms without classificationMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseStoreValues();
  });

  it('enables type selection when legacy enableTypeSelection: true without classificationMode', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Attachment
        onEvent={vi.fn()}
        component={{
          enableTypeSelection: true,
          attachmentTypes: [
            { label: 'Recepción', identifier: 1 },
            { label: 'Envío', identifier: 2 },
          ],
        }}
      />
    );
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });

    await user.upload(fileInput, file);

    await screen.findByText('photo.jpg');
    expect(screen.getByLabelText('Recepción')).toBeChecked();
  });

  it('enables tipoFoto dropdown when legacy tipoFotoItems present without classificationMode', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Attachment
        onEvent={vi.fn()}
        component={{
          tipoFotoItems: [{ label: 'Cédula' }, { label: 'Factura' }],
          tipoFotoRequired: true,
        }}
      />
    );
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['img'], 'doc.jpg', { type: 'image/jpeg' });

    await user.upload(fileInput, file);

    await screen.findByText('doc.jpg');
    expect(screen.getByText('Sin tipo')).toBeInTheDocument();
  });
});

describe('classificationMode: none', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseStoreValues();
  });

  it('does not show type selector or tipoFoto dropdown', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Attachment
        onEvent={vi.fn()}
        component={{ classificationMode: 'none' }}
      />
    );
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['img'], 'plain.jpg', { type: 'image/jpeg' });

    await user.upload(fileInput, file);

    await screen.findByText('plain.jpg');
    expect(screen.queryByText('Sin tipo')).not.toBeInTheDocument();
    expect(screen.queryByText('Tipo:')).not.toBeInTheDocument();
  });
});

describe('classificationMode: tipoFoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseStoreValues();
  });

  it('shows unclassified warning and allows assigning a category', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Attachment
        onEvent={vi.fn()}
        component={{
          classificationMode: 'tipoFoto',
          tipoFotoItems: [{ label: 'Cédula' }, { label: 'Factura' }],
          tipoFotoRequired: true,
        }}
      />
    );
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['img'], 'id_card.jpg', { type: 'image/jpeg' });

    await user.upload(fileInput, file);

    await screen.findByText('id_card.jpg');
    expect(
      screen.getByText(/deben tener un.*tipo de foto/i)
    ).toBeInTheDocument();

    await user.click(screen.getByText('Sin tipo'));
    await user.click(screen.getByText('Cédula'));

    await waitFor(() => {
      expect(
        screen.queryByText(/deben tener un.*tipo de foto/i)
      ).not.toBeInTheDocument();
    });
  });
});

describe('Attachment type selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseStoreValues();
  });

  it('persists the selected Envio option as attachmentType 2 for upload', async () => {
    const user = userEvent.setup();
    const { container } = renderAttachment();
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['image'], 'DJI_0060_Moment.jpg', {
      type: 'image/jpeg',
    });

    await user.upload(fileInput, file);

    await screen.findByText('DJI_0060_Moment.jpg');
    expect(screen.getByLabelText('Recepción')).toBeChecked();
    await user.click(screen.getByLabelText('Envío'));
    expect(screen.getByLabelText('Envío')).toBeChecked();

    await waitFor(() => {
      expect(storeSet).toHaveBeenLastCalledWith('cases.attachments', [
        expect.objectContaining({
          path: 'DJI_0060_Moment.jpg',
          attachmentType: 2,
        }),
      ]);
    });
  });

  it('checks Envio for a prefetched backend attachment with type 2', async () => {
    mockBaseStoreValues({
      'cases.generated_case_id': null,
      'cases.case_data': { id: 'case-123' },
      'cases.attachments_prefetched': true,
      'cases.attachments': [
        {
          id: 'attachment-1',
          path: 'DJI_0060_Moment.jpg',
          description: 'image/jpeg',
          type: 2,
          s3_payload: {
            id: 'case-123',
            contentType: 'image/jpeg',
            fileName: 'DJI_0060_Moment.jpg',
            url: 'case',
          },
        },
      ],
    });

    renderAttachment();

    await screen.findByText('DJI_0060_Moment.jpg');
    expect(screen.getByLabelText('Envío')).toBeChecked();
  });
});
