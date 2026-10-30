import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const RadioComponent = KaceBaseComponent.create({
  componentType: 'kace_radio',
  formioBaseComponent: 'radio',
  builderInfo: {
    title: 'Kace Radio',
    icon: 'dot-circle-o',
    preview: true,
  },
});

RadioComponent.COMPONENT_TYPE = 'kace_radio';

export default RadioComponent;
