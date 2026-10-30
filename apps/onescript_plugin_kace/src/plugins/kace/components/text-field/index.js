import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';

const TextFieldComponent = KaceBaseComponent.create({
  componentType: 'kace_text_field',
  formioBaseComponent: 'textfield',
  builderInfo: {
    title: 'Kace TextField',
    icon: 'terminal',
    preview: true,
  },
});

TextFieldComponent.COMPONENT_TYPE = 'kace_text_field';

export default TextFieldComponent;
