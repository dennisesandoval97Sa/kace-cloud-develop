export const capitalize = (str = '') =>
  str.charAt(0).toUpperCase() + str.slice(1);

export const kebabToCamel = (str = '') =>
  str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
