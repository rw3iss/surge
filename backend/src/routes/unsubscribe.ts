/**
 * Public unsubscribe + confirmation endpoints. Mounted at the public
 * root (NOT under `/api/v1`) so the URL shape (`/u/<token>`) stays
 * short and works as a `List-Unsubscribe` header target.
 *
 *   GET /u/:token                             — unsubscribe
 *   GET /u/:token/resubscribe                 — opt back in
 *   GET /lists/:slug/confirm/:token           — double-opt-in confirmation
 */
import { Router, } from 'express';
import * as lists from '../repositories/mailingLists.repo';
import * as subs from '../repositories/mailingListSubscribers.repo';
import { verifyUnsubscribeToken, } from '../services/mail/unsubscribe';

const router = Router();

function page(title: string, body: string,): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title,)}</title>
<style>
    body{font:14px/1.5 system-ui,-apple-system,sans-serif;max-width:480px;margin:8vh auto;padding:0 1rem;color:#333}
    h1{font-size:1.4rem;margin-bottom:.5rem}
    .btn{display:inline-block;padding:.5rem 1rem;background:#3498cf;color:#fff;border-radius:6px;text-decoration:none;margin-top:.5rem}
</style></head><body>${body}</body></html>`;
}

function escapeHtml(s: string,): string {
    return s.replace(/[&<>"']/g, (c,) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!,);
}

router.get('/u/:token', async (req, res,) => {
    const verified = verifyUnsubscribeToken(req.params.token,);
    if (!verified) {
        res.status(400,).type('html',).send(page('Unsubscribe', '<h1>Invalid unsubscribe link.</h1>',),);
        return;
    }
    const sub = await subs.findById(verified.subscriberId,);
    const list = await lists.findById(verified.listId,);
    if (!sub || !list) {
        res.status(404,).type('html',).send(page('Unsubscribe', '<h1>Subscriber not found.</h1>',),);
        return;
    }
    if (sub.status !== 'unsubscribed') await subs.setStatus(sub.id, 'unsubscribed',);
    res.type('html',).send(page('Unsubscribed', `
        <h1>You have been unsubscribed from ${escapeHtml(list.name,)}.</h1>
        <p>Changed your mind?</p>
        <p><a class="btn" href="/u/${encodeURIComponent(req.params.token,)}/resubscribe">Resubscribe</a></p>
    `,),);
},);

router.get('/u/:token/resubscribe', async (req, res,) => {
    const verified = verifyUnsubscribeToken(req.params.token,);
    if (!verified) {
        res.status(400,).type('html',).send(page('Resubscribe', '<h1>Invalid link.</h1>',),);
        return;
    }
    const sub = await subs.findById(verified.subscriberId,);
    const list = await lists.findById(verified.listId,);
    if (!sub || !list) {
        res.status(404,).type('html',).send(page('Resubscribe', '<h1>Subscriber not found.</h1>',),);
        return;
    }
    const target = list.doubleOptIn ? 'pending_confirmation' : 'subscribed';
    await subs.setStatus(sub.id, target,);
    res.type('html',).send(page('Resubscribed', `
        <h1>Welcome back to ${escapeHtml(list.name,)}.</h1>
        ${target === 'pending_confirmation' ? '<p>Please check your email to confirm your subscription.</p>' : ''}
    `,),);
},);

router.get('/lists/:slug/confirm/:token', async (req, res,) => {
    const list = await lists.findBySlug(req.params.slug,);
    if (!list) {
        res.status(404,).type('html',).send(page('Confirm', '<h1>List not found.</h1>',),);
        return;
    }
    const sub = await subs.findByConfirmationToken(list.id, req.params.token,);
    if (!sub) {
        res.status(400,).type('html',).send(page('Confirm', '<h1>Invalid or expired confirmation link.</h1>',),);
        return;
    }
    await subs.setStatus(sub.id, 'subscribed',);
    await subs.clearConfirmationToken(sub.id,);
    res.type('html',).send(page('Confirmed', `
        <h1>Subscription confirmed.</h1>
        <p>You're now subscribed to <strong>${escapeHtml(list.name,)}</strong>.</p>
    `,),);
},);

export default router;
