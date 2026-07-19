/**
 * Form action dispatch.
 *
 * Runs AFTER a submission is saved (the submission is always recorded, so the
 * action is a side-effect layered on top). Best-effort: any failure is logged
 * and swallowed so it never fails the submitter's request.
 *
 *   - submit    → no-op (the submission row is the whole point).
 *   - subscribe → add the submitter's email to a mailing list (double-opt-in
 *                 aware; gated on the `mailing_lists` feature).
 *   - email     → render To/Subject/Body templates against the submitted field
 *                 values and send via the mail provider.
 *
 * Field variables use the shared `deriveFieldKeys` so the tokens the admin sees
 * in the editor match what resolves here.
 */
import type { Form, FormActionConfig, FormQuestion, TemplateRuntime, } from '@sitesurge/types';
import { deriveFieldKeys, hasTemplateSyntax, renderTemplate, } from '@sitesurge/types';
import * as mailingListsRepo from '../repositories/mailingLists.repo';
import { sendEmail, } from './email';
import * as mailingLists from './mailingLists';
import { isFeatureEnabledServer, } from './settings';
import { escapeHtml, } from './ssr/blocks/_util';
import { logger, } from '../utils/logger';

interface SubmittedAnswer {
    questionId: string;
    value: unknown;
}

export interface FormActor {
    userId?: string;
    userEmail?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Flatten an answer value to a display string. */
function formatValue(v: unknown,): string {
    if (v == null) return '';
    if (Array.isArray(v,)) return v.join(', ',);
    return String(v,);
}

/**
 * Build the flat `{ key: value }` template context from the submitted answers.
 * `escape` HTML-escapes each value (for the HTML email body, since values are
 * untrusted); pass false for plain-text targets (To / Subject).
 */
function buildContext(
    form: Form,
    questions: FormQuestion[],
    answers: SubmittedAnswer[],
    escape: boolean,
): Record<string, unknown> {
    const keys = deriveFieldKeys(questions,);
    const enc = (s: string,) => (escape ? escapeHtml(s,) : s);
    const ctx: Record<string, unknown> = {};
    for (const q of questions) {
        const ans = answers.find((a,) => a.questionId === q.id);
        ctx[keys[q.id]] = enc(formatValue(ans?.value,),);
    }
    ctx.form_title = enc(form.title,);
    ctx.submitted_at = new Date().toLocaleString();
    return ctx;
}

/** Value of the first question matching a predicate (by derived key or type). */
function valueByKey(
    questions: FormQuestion[],
    answers: SubmittedAnswer[],
    key: string,
): string | null {
    const keys = deriveFieldKeys(questions,);
    const q = questions.find((qq,) => keys[qq.id] === key);
    if (!q) return null;
    const ans = answers.find((a,) => a.questionId === q.id);
    const v = formatValue(ans?.value,).trim();
    return v || null;
}

/** The submitter's email: a question of type `email`, else derived key `email`. */
function extractEmail(questions: FormQuestion[], answers: SubmittedAnswer[],): string | null {
    const emailQ = questions.find((q,) => q.type === 'email');
    if (emailQ) {
        const ans = answers.find((a,) => a.questionId === emailQ.id);
        const v = formatValue(ans?.value,).trim();
        if (v) return v;
    }
    return valueByKey(questions, answers, 'email',);
}

/** Render a `{{ … }}` template against a flat form-value context → string. */
async function renderTpl(tpl: string, context: Record<string, unknown>,): Promise<string> {
    if (!tpl || !hasTemplateSyntax(tpl,)) return tpl ?? '';
    const runtime: TemplateRuntime = {
        context,
        resolve: () => undefined,
        warn: (m,) => logger.debug?.(m,),
    };
    try {
        const nodes = await renderTemplate(tpl, runtime,);
        return nodes.map((n,) => (n.type === 'html' ? n.html : '')).join('',);
    } catch (e) {
        logger.warn('form email template render failed', { error: (e as Error).message, },);
        return tpl;
    }
}

async function runSubscribe(
    form: Form,
    cfg: FormActionConfig,
    questions: FormQuestion[],
    answers: SubmittedAnswer[],
    actor: FormActor,
): Promise<void> {
    if (!(await isFeatureEnabledServer('mailing_lists',))) {
        logger.warn('form subscribe action skipped: mailing_lists feature disabled', { form: form.id, },);
        return;
    }
    if (!cfg.mailingListId) {
        logger.warn('form subscribe action: no mailingListId configured', { form: form.id, },);
        return;
    }
    const email = extractEmail(questions, answers,);
    if (!email) {
        logger.warn('form subscribe action: no email field value', { form: form.id, },);
        return;
    }
    const list = await mailingListsRepo.findById(cfg.mailingListId,);
    if (!list) {
        logger.warn('form subscribe action: mailing list not found', { listId: cfg.mailingListId, },);
        return;
    }
    const name = valueByKey(questions, answers, 'name',) ?? undefined;
    const phone = valueByKey(questions, answers, 'phone',) ?? undefined;
    await mailingLists.publicSubscribe(
        list.slug,
        { email, name, phone, },
        { userId: actor.userId, userEmail: actor.userEmail, },
    );
}

async function runEmail(
    form: Form,
    cfg: FormActionConfig,
    questions: FormQuestion[],
    answers: SubmittedAnswer[],
): Promise<void> {
    const rawCtx = buildContext(form, questions, answers, false,);
    const htmlCtx = buildContext(form, questions, answers, true,);

    const to = (await renderTpl(cfg.emailTo || '', rawCtx,)).trim();
    if (!to || !EMAIL_RE.test(to,)) {
        logger.warn('form email action: recipient missing/invalid after render', { form: form.id, to, },);
        return;
    }
    const subject = (await renderTpl(cfg.emailSubject || '', rawCtx,)).trim()
        || `New submission: ${form.title}`;
    const body = (await renderTpl(cfg.emailBody || '', htmlCtx,)).trim()
        || '<p>A form was submitted.</p>';

    await sendEmail({ to, subject, html: body, },);
}

/**
 * Dispatch a form's configured action. Never throws — logs and returns.
 */
export async function dispatchFormAction(
    form: Form,
    questions: FormQuestion[],
    answers: SubmittedAnswer[],
    actor: FormActor = {},
): Promise<void> {
    const action = form.action || 'submit';
    if (action === 'submit') return;
    const cfg = (form.actionConfig || {}) as FormActionConfig;
    try {
        if (action === 'subscribe') {
            await runSubscribe(form, cfg, questions, answers, actor,);
        } else if (action === 'email') {
            await runEmail(form, cfg, questions, answers,);
        }
    } catch (e) {
        logger.warn('form action dispatch failed', {
            action,
            form: form.id,
            error: (e as Error).message,
        },);
    }
}
