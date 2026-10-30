import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const CheckboxComponent = KaceBaseComponent.create({
  componentType: 'kace_checkbox',
  formioBaseComponent: 'checkbox',
  builderInfo: {
    title: 'Kace Checkbox',
    icon: 'check-square',
    preview: true,
  },
});

CheckboxComponent.COMPONENT_TYPE = 'kace_checkbox';

export default CheckboxComponent;
