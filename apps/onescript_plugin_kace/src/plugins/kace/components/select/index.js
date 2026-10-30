import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const SelectComponent = KaceBaseComponent.create({
  componentType: 'kace_select',
  formioBaseComponent: 'select',
  builderInfo: {
    title: 'Kace Select',
    icon: 'th-list',
    preview: true,
  },
});

SelectComponent.COMPONENT_TYPE = 'kace_select';

export default SelectComponent;
