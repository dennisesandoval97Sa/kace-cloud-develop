import { v4 as uuid } from 'uuid';
import { EmailSender } from '../../src/emails/application/send/EmailSender.js';
import { EmailReplier } from '../../src/emails/application/reply/EmailReplier.js';

const finderReturning = (jsonValue) => ({
    execute: async () => ({ toJson: () => jsonValue }),
});

const buildContextFinders = () => ({
    clientFinder: finderReturning({ data: { email: 'cliente@real.com', nombres: 'Ana' } }),
    userFinder: finderReturning({ nombres: 'Pedro', email: 'pedro@kace.com' }),
    classificationFinder: finderReturning({ data: { nivel1: 'Soporte' } }),
    auxCasesFinder: finderReturning({ data: { data: {} } }),
    auxClientsFinder: finderReturning({ data: { data: {} } }),
});

const buildCaseEntity = () => ({
    id: { value: uuid() },
    cliente_id: { value: uuid() },
    responsable_id: { value: uuid() },
    clasificacion_id: { value: uuid() },
    reference: { value: 123 },
    toJson: () => ({ estado: 'abierto' }),
});

const buildCommonDeps = ({ onWorkflow, sendResponse }) => {
    const captured = {};
    const saved = {};
    return {
        captured,
        saved,
        deps: {
            caseRepository: { find: async () => buildCaseEntity() },
            channelHubAccountRepository: {
                findByEmail: async () => ({
                    channel_hub_connection_id: { value: 'conn-1' },
                    id: { value: uuid() },
                }),
            },
            interactionRepository: { find: async () => ({ workspace_id: { value: uuid() } }) },
            emailRepository: {
                save: async (e) => {
                    saved.email = e;
                },
            },
            emailBodyRepository: {
                save: async (b) => {
                    saved.body = b;
                },
            },
            attachmentPersister: {
                prepare: async (urls) => (urls ?? []).map((url) => ({ url, filename: null, size: 0 })),
                persist: async () => {},
            },
            workflowExecutor: {
                execute: async ({ initial_context }) => {
                    captured.payload = initial_context.channel_hub;
                    onWorkflow?.();
                    return { toJson: () => ({ data: { context: { channel_hub: sendResponse } } }) };
                },
            },
            ...buildContextFinders(),
        },
    };
};

describe('EmailSender — reemplazo de campos de plantilla', () => {
    const sendResponse = { send_response: { messageId: 'msg-1' } };

    it('reemplaza {{campos}} en to, subject y cuerpo con el contexto del caso', async () => {
        const { captured, saved, deps } = buildCommonDeps({ sendResponse });
        const sender = new EmailSender(deps);

        const dto = {
            case_id: uuid(),
            interaction_id: uuid(),
            from: 'agent@kace.com',
            to: ['{{clients.email}}'],
            subject: 'Hola {{clients.nombres}}',
            message_to_send: '<p>Estimado {{clients.nombres}}, atendido por {{usuarios.nombres}}</p>',
        };

        await sender.execute(dto, uuid());

        expect(captured.payload.to).toEqual(['cliente@real.com']);
        expect(captured.payload.subject).toBe('Hola Ana');
        expect(captured.payload.html).toBe('<p>Estimado Ana, atendido por Pedro</p>');
        expect(saved.email.subject.value).toBe('Hola Ana');
        expect(saved.body.body.value).toBe('<p>Estimado Ana, atendido por Pedro</p>');
    });

    it('no altera el texto cuando no hay {{campos}} (no-op)', async () => {
        const { captured, deps } = buildCommonDeps({ sendResponse });
        const sender = new EmailSender(deps);

        const dto = {
            case_id: uuid(),
            interaction_id: uuid(),
            from: 'agent@kace.com',
            to: ['cliente@real.com'],
            subject: 'Asunto plano',
            message_to_send: '<p>Cuerpo sin variables</p>',
        };

        await sender.execute(dto, uuid());

        expect(captured.payload.to).toEqual(['cliente@real.com']);
        expect(captured.payload.subject).toBe('Asunto plano');
        expect(captured.payload.html).toBe('<p>Cuerpo sin variables</p>');
    });

    it('falla y no llama a Channel Hub si un destinatario tiene una variable sin resolver', async () => {
        let workflowCalled = false;
        const { deps } = buildCommonDeps({
            sendResponse,
            onWorkflow: () => {
                workflowCalled = true;
            },
        });
        const sender = new EmailSender(deps);

        const dto = {
            case_id: uuid(),
            interaction_id: uuid(),
            from: 'agent@kace.com',
            to: ['{{clients.telefono}}'],
            subject: 'x',
            message_to_send: 'y',
        };

        await expect(sender.execute(dto, uuid())).rejects.toThrow();
        expect(workflowCalled).toBe(false);
    });
});

describe('EmailReplier — reemplazo de campos en el cuerpo', () => {
    const replyResponse = {
        reply_response: {
            messageId: 'msg-r',
            threadId: 'thread-1',
            subject: 'Re: caso',
            destination: { to: ['cliente@real.com'], cc: [], bcc: [] },
        },
    };

    it('reemplaza {{campos}} en reply_message_to_send', async () => {
        const { captured, saved, deps } = buildCommonDeps({ sendResponse: replyResponse });
        const replier = new EmailReplier(deps);

        const dto = {
            case_id: uuid(),
            interaction_id: uuid(),
            from: 'agent@kace.com',
            in_reply_to: 'orig-msg',
            reply_message_to_send: '<p>Hola {{clients.nombres}}</p>',
            is_reply_all: false,
        };

        await replier.execute(dto, uuid());

        expect(captured.payload.replyMessage).toBe('<p>Hola Ana</p>');
        expect(saved.body.body.value).toBe('<p>Hola Ana</p>');
    });

    it('reemplaza {{campos}} en cc y bcc del reply', async () => {
        const { captured, deps } = buildCommonDeps({ sendResponse: replyResponse });
        const replier = new EmailReplier(deps);

        const dto = {
            case_id: uuid(),
            interaction_id: uuid(),
            from: 'agent@kace.com',
            in_reply_to: 'orig-msg',
            reply_message_to_send: '<p>Respuesta</p>',
            is_reply_all: true,
            cc: ['{{clients.email}}', 'fijo@konecta.com'],
            bcc: ['jefe@konecta.com'],
        };

        await replier.execute(dto, uuid());

        expect(captured.payload.cc).toEqual(['cliente@real.com', 'fijo@konecta.com']);
        expect(captured.payload.bcc).toEqual(['jefe@konecta.com']);
    });

    it('falla y no llama a Channel Hub si cc del reply tiene una variable sin resolver', async () => {
        let workflowCalled = false;
        const { deps } = buildCommonDeps({
            sendResponse: replyResponse,
            onWorkflow: () => {
                workflowCalled = true;
            },
        });
        const replier = new EmailReplier(deps);

        const dto = {
            case_id: uuid(),
            interaction_id: uuid(),
            from: 'agent@kace.com',
            in_reply_to: 'orig-msg',
            reply_message_to_send: '<p>Respuesta</p>',
            is_reply_all: true,
            cc: ['{{clients.telefono}}'],
        };

        await expect(replier.execute(dto, uuid())).rejects.toThrow();
        expect(workflowCalled).toBe(false);
    });
});
