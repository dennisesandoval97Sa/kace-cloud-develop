import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const NumberComponent = KaceBaseComponent.create({
  componentType: 'kace_number',
  formioBaseComponent: 'number',
  builderInfo: {
    title: 'Kace Number',
    icon: 'hashtag',
    preview: true,
  },
});

NumberComponent.COMPONENT_TYPE = 'kace_number';

export default NumberComponent;
