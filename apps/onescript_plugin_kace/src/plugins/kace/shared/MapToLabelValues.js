export const getValueByPath = (obj, path) => {
  return path.split('.').reduce((acc, key) => {
    return acc && acc[key] !== undefined ? acc[key] : undefined;
  }, obj);
};

export const mapToLabelValue = (arr, path) => {
  if (!arr || !arr.length || !path) return [];
  return arr.map((item) => {
    const value = getValueByPath(item, path);
    return {
      label: value,
      value,
    };
  });
};
