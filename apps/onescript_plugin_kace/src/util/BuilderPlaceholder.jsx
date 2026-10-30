/**
 * @param {{ label: string }} props
 */
export const BuilderPlaceholder = ({ label }) => (
  <div style={{ padding: '15px', border: '2px dashed #cdcdcd' }}>
    <div style={{ display: 'table', margin: '0 auto' }}>{label}</div>
  </div>
);
