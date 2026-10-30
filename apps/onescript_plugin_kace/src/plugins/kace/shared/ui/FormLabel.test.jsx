import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormLabel } from './FormLabel.jsx';

describe('FormLabel', () => {
  it('always carries the base font-weight-medium class', () => {
    render(<FormLabel component={{}}>Nombre</FormLabel>);
    expect(screen.getByText('Nombre')).toHaveClass('font-weight-medium');
  });

  it('adds field-required when component.validate.required is truthy', () => {
    render(
      <FormLabel component={{ validate: { required: true } }}>Nombre</FormLabel>
    );
    expect(screen.getByText('Nombre')).toHaveClass('field-required');
  });

  it('does not add field-required when required is falsy or absent', () => {
    render(
      <FormLabel component={{ validate: { required: false } }}>A</FormLabel>
    );
    render(<FormLabel component={{}}>B</FormLabel>);
    render(<FormLabel>C</FormLabel>);
    expect(screen.getByText('A')).not.toHaveClass('field-required');
    expect(screen.getByText('B')).not.toHaveClass('field-required');
    expect(screen.getByText('C')).not.toHaveClass('field-required');
  });

  it('appends any extra className and forwards passthrough props', () => {
    render(
      <FormLabel
        component={{ validate: { required: true } }}
        className="mb-2"
        htmlFor="field_key"
      >
        Nombre
      </FormLabel>
    );
    const label = screen.getByText('Nombre');
    expect(label).toHaveClass('font-weight-medium');
    expect(label).toHaveClass('field-required');
    expect(label).toHaveClass('mb-2');
    expect(label).toHaveAttribute('for', 'field_key');
  });
});
