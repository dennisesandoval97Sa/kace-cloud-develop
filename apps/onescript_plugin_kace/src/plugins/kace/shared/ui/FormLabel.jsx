import React from 'react';

/**
 * Etiqueta de campo compartida por los componentes React-island de Form.io.
 * Añade la clase `field-required` (asterisco rojo, regla CSS de formiojs) cuando
 * el schema del componente define `validate.required`.
 *
 * @param {{
 *   component?: { validate?: { required?: unknown } },
 *   children: React.ReactNode,
 *   className?: string,
 * } & React.LabelHTMLAttributes<HTMLLabelElement>} props
 */
export const FormLabel = ({ component, children, className = '', ...rest }) => {
  const isRequired = Boolean(component?.validate?.required);
  const cls = `font-weight-medium${isRequired ? ' field-required' : ''}${
    className ? ` ${className}` : ''
  }`;

  return (
    <label className={cls} {...rest}>
      {children}
    </label>
  );
};
