import React from 'react';

/**
 * @typedef TableColumn
 * @property {string} key - Nombre de la propiedad en cada fila de datos
 * @property {string} label - Texto a mostrar en el encabezado
 * @property {(row: any) => React.ReactNode} [render] - Render personalizado de la celda
 */

/**
 * Tabla genérica y reutilizable para usar dentro del Drawer
 *
 * @param {{
 *  columns: TableColumn[];
 *  data: any[];
 *  keyField?: string;
 *  className?: string;
 *  emptyMessage?: string;
 *  onRowClick?: (row: any) => void;
 * }} props
 */
export const Table = ({
  columns,
  data,
  keyField = 'id',
  className = '',
  emptyMessage = 'Sin datos para mostrar',
  onRowClick,
}) => {
  const getRowKey = (row, index) => {
    if (row && typeof row === 'object' && keyField in row) {
      return String(row[keyField]);
    }
    return `${index}`;
  };

  const handleRowClick = (row) => {
    if (typeof onRowClick === 'function') {
      onRowClick(row);
    }
  };

  return (
    <div className="kace-table-wrapper">
      <table className={`table table-striped table-hover ${className}`}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          )}

          {data.map((row, index) => (
            <tr
              key={getRowKey(row, index)}
              onClick={() => handleRowClick(row)}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((column) => (
                <td key={column.key}>
                  {typeof column.render === 'function'
                    ? column.render(row)
                    : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
