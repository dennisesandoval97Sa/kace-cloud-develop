import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BulkActionModalSelect } from './BulkActionModalSelect.jsx';

describe('BulkActionModalSelect', () => {
  it('filters options locally in legacy mode', async () => {
    const user = userEvent.setup();
    render(
      <BulkActionModalSelect
        id="f-user"
        fieldKey="user"
        fieldLabel="Usuario"
        value=""
        options={[
          { label: 'Ana Garcia', value: '1' },
          { label: 'Pedro Lopez', value: '2' },
        ]}
        showWhenCode=""
        evaluateShowWhen={vi.fn()}
        setSelectOptions={vi.fn()}
        onChange={vi.fn()}
        disabled={false}
        dependencySignature="{}"
      />
    );
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Buscar...'), 'ana');
    expect(screen.getByText('Ana Garcia')).toBeInTheDocument();
    expect(screen.queryByText('Pedro Lopez')).not.toBeInTheDocument();
  });
});
