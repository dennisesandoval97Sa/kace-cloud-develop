import '#plugins/kace/shared/styles/kace-floating-controls.css';
import { Components } from '@formio/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Swal from 'sweetalert2';

import customTabEditForm from './custom.form.json';
import { BuilderPlaceholder } from '#util/BuilderPlaceholder.jsx';
import { EmailForm } from './EmailForm.jsx';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';

const FormioComponent = Components.components.container;

class EmailFormError extends Error {}

export default class EmailFormComponent extends FormioComponent {
  static get COMPONENT_TYPE() {
    return 'kace_email_form';
  }

  /**
   * @param {...import('formiojs').ExtendedComponentSchema} extend
   */
  static schema(...extend) {
    return FormioComponent.schema({
      type: EmailFormComponent.COMPONENT_TYPE,
      key: EmailFormComponent.COMPONENT_TYPE,
      label: 'Email Form',
      hideLabel: true,
      templateOptions: [],
      fromLocked: false,
      toLocked: false,
      ccLocked: false,
      bccLocked: false,
      subjectLocked: false,
      templateLocked: false,
      bodyLocked: false,
      attachmentsLocked: false,
      replyLocked: false,
      replyAllLocked: false,
      newEmailLocked: false,
      cancelLocked: false,
      sendLocked: false,
      replyHidden: false,
      replyAllHidden: false,
      newEmailHidden: false,
      cancelHidden: false,
      sendHidden: false,
      bodyMode: false,
      receivedEmailAutoLoad: true,
      receivedAttachmentsS3Bucket: 'attachments',
      customDownloadAttachmentCode: '',
      floatingButton: false,
      saveCaseBeforeSend: false,
      sendButtonText: 'Enviar',
      sendingButtonText: 'Enviando...',
      sendButtonIcon: 'fa fa-paper-plane',
      sendButtonIconHidden: false,
      sendButtonColor: '',
      customSendCode: '',
      customSaveCode: '',
      onMountCode: '',
      onActionChangeCode: '',
      ...extend,
    });
  }

  static get builderInfo() {
    return {
      title: 'Kace Email Form',
      icon: 'envelope',
      preview: true,
      schema: EmailFormComponent.schema(),
    };
  }

  static editForm = (...extend) => {
    return Components.baseEditForm([customTabEditForm], ...extend);
  };

  render() {
    const componentType = EmailFormComponent.COMPONENT_TYPE;
    return super.render(
      `<div id="${componentType}-${this.component.id}"></div>`
    );
  }

  attach(element) {
    this.reactRoot?.unmount();
    super.attach(element);

    const componentType = EmailFormComponent.COMPONENT_TYPE;
    const elem = element.querySelector(
      `#${componentType}-${this.component.id}`
    );
    if (!elem) return;
    this.reactRoot = createRoot(elem);

    if (this.builderMode)
      return this.reactRoot.render(
        createElement(BuilderPlaceholder, { label: this.component.label })
      );

    this.root.submission.data = this.root.submission.data || {};

    /**
     * Persist email form data into the submission on every submit action.
     * @param {import('./EmailForm.jsx').EmailFormData} formData
     */
    const handleSubmit = (formData) => {
      if (!this.root.submission.data.case_data) {
        this.root.submission.data.case_data = {};
      }
      this.root.submission.data.case_data.email = formData;
      this.emit('emailFormSubmit', formData);
    };

    const handleCancel = () => {
      this.emit('emailFormCancel', {});
    };

    const handleActionChange = (action) => {
      if (!this.root.submission.data.case_data) {
        this.root.submission.data.case_data = {};
      }
      this.root.submission.data.case_data.email_active_action = action;
      this.emit('emailFormActionChange', { action });
    };

    const {
      templateOptions = [],
      fromLocked = false,
      fromHidden = false,
      toLocked = false,
      ccLocked = false,
      bccLocked = false,
      subjectLocked = false,
      templateLocked = false,
      bodyLocked = false,
      attachmentsLocked = false,
      replyLocked = false,
      replyAllLocked = false,
      newEmailLocked = false,
      cancelLocked = false,
      sendLocked = false,
      replyHidden = false,
      replyAllHidden = false,
      newEmailHidden = false,
      cancelHidden = false,
      sendHidden = false,
      bodyMode = false,
      receivedEmailAutoLoad = true,
      receivedAttachments = [],
      receivedAttachmentsS3Bucket = 'attachments',
      customDownloadAttachmentCode = '',
      floatingButton = false,
      saveCaseBeforeSend = false,
      sendButtonText = 'Enviar',
      sendingButtonText = 'Enviando...',
      sendButtonIcon = 'fa fa-paper-plane',
      sendButtonIconHidden = false,
      sendButtonColor = '',
      customSendCode = '',
      customSaveCode = '',
      onMountCode = '',
      onActionChangeCode = '',
    } = this.component;

    const getSubmissionData = () =>
      this.root?.submission?.data ?? this.root?.data ?? {};

    const customSendHandler = customSendCode?.trim()
      ? async (payload, context) => {
          return evaluateKace(customSendCode, { ...context, payload });
        }
      : null;

    const emitEvent = (eventName, payload) => {
      this.emit(eventName, payload);
    };

    const customDownloadAttachmentHandler = customDownloadAttachmentCode?.trim()
      ? async (attachment, context) => {
          return evaluateKace(customDownloadAttachmentCode, {
            ...context,
            attachment,
          });
        }
      : null;

    const customSaveHandler = customSaveCode?.trim()
      ? async (context) => {
          const formRoot = this.root?.globalRoot ?? this.root;
          const formEvalData =
            this.root?.submission?.data ?? this.root?.data ?? {};
          return evaluateKace(customSaveCode, {
            ...context,
            instance: this,
            root: formRoot,
            data: formEvalData,
            Swal,
          });
        }
      : null;

    this.reactRoot.render(
      createElement(EmailForm, {
        templateOptions,
        fromLocked,
        fromHidden,
        toLocked,
        ccLocked,
        bccLocked,
        subjectLocked,
        templateLocked,
        bodyLocked,
        attachmentsLocked,
        replyLocked,
        replyAllLocked,
        newEmailLocked,
        cancelLocked,
        sendLocked,
        replyHidden,
        replyAllHidden,
        newEmailHidden,
        cancelHidden,
        sendHidden,
        bodyMode,
        receivedEmailAutoLoad,
        receivedAttachments,
        receivedAttachmentsS3Bucket,
        customDownloadAttachmentHandler,
        customSendHandler,
        customSaveHandler,
        saveCaseBeforeSend,
        floatingButton,
        sendButtonText,
        sendingButtonText,
        sendButtonIcon,
        sendButtonIconHidden,
        sendButtonColor,
        onSubmit: handleSubmit,
        onCancel: handleCancel,
        onActionChange: handleActionChange,
        submissionData: getSubmissionData,
        emitEvent,
        onMountCode,
        onActionChangeCode,
      })
    );
  }

  detach() {
    this.reactRoot?.unmount();
    super.detach();
  }
}
