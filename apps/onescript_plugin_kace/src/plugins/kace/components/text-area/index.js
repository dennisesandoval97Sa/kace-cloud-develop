import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const TextAreaComponent = KaceBaseComponent.create({
  componentType: 'kace_text_area',
  formioBaseComponent: 'textarea',
  builderInfo: {
    title: 'Kace TextArea',
    icon: 'font',
    preview: true,
  },
});

TextAreaComponent.COMPONENT_TYPE = 'kace_text_area';

export default TextAreaComponent;
