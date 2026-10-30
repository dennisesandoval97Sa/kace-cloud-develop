import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CustomAuxLiteralsList } from './CustomAuxLiteralsList.jsx';

const _stableKaceEngineInstance = {
  getService: (name) =>
    name === 'storeService'
      ? { get: () => 'http://localhost' }
      : { get: vi.fn(), post: vi.fn() },
};
vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => _stableKaceEngineInstance,
}));

vi.mock('#plugins/kace/shared/evaluateKace.js', () => ({
  evaluateKace: vi.fn(() => undefined),
}));

const renderComponent = (component) =>
  render(
    <CustomAuxLiteralsList
      component={component}
      value=""
      updateValue={vi.fn()}
    />
  );

describe('CustomAuxLiteralsList required-field asterisk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the label as required when component.validate.required is true', () => {
    renderComponent({
      key: 'literals1',
      label: 'Reference Literals',
      validate: { required: true },
    });
    expect(screen.getByText('Reference Literals')).toHaveClass(
      'field-required'
    );
  });

  it('does not mark the label as required when validate.required is falsy', () => {
    renderComponent({ key: 'literals2', label: 'Reference Literals' });
    expect(screen.getByText('Reference Literals')).not.toHaveClass(
      'field-required'
    );
  });
});
