import { chance, Factory, uuidv4 } from './Factory.js';
import { HelpsAttachments, KnexHelpsAttachmentsRepository } from '../helps_attachments/index.js';
import { HelpsFactory } from './HelpsFactory.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export const HelpsAttachmentsFactory = new Factory(KnexHelpsAttachmentsRepository, HelpsAttachments);

const extensionsToMimeTypes = {
    txt: 'text/plain',
    jpg: 'image/jpeg',
    png: 'image/png',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const extension = chance.pickone(Object.keys(extensionsToMimeTypes));
const path = `${chance.word().replace(/[.,]/g, '')}.${extension}`;
const tipo = extensionsToMimeTypes[extension];

HelpsAttachmentsFactory.define({
    id: () => uuidv4(),
    path,
    tipo,
    created_at: new Date().toISOString(),
    created_by: uuidv4(),
})
    .relation('help_id', HelpsFactory)
    .afterMaking((helpsAttachments) => {
        Helper.logInfo(`helpsAttachments made with id: ${helpsAttachments.id}`);
    })
    .afterCreating((helpsAttachments) => {
        Helper.logInfo(`helpsAttachments created with id: ${helpsAttachments.id}`);
    });
