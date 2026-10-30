export const formatedDate = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  const formattedDate = date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return formattedDate;
};

export const MONTH_TYPE = {
  LONG: 'long',
  NUMBER: 'number',
};

export const formattedDateWithDate = (
  fechaString,
  monthType = MONTH_TYPE.LONG
) => {
  if (!fechaString) return '';

  const date = new Date(fechaString);

  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  // FORMATO NUMBER → YYYY/MM/DD HH:mm:ss
  if (monthType === MONTH_TYPE.NUMBER) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  // FORMATO LONG → DD/mes/YYYY
  const month = date.toLocaleString('es-ES', { month: 'long' });

  return `${day}/${month}/${year}`;
};

export const formetedName = (name, last_Name) => {
  const firstName = name.charAt(0).toUpperCase() + name.slice(1);
  const lastName = last_Name.charAt(0).toUpperCase() + last_Name.slice(1);

  return `${firstName} ${lastName}`;
};
