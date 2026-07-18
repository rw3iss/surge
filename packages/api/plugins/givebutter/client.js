// GiveButter plugin — framework-agnostic browser client (plain ESM, no build step).
// Only a config page: the donation widget itself is rendered by the CMS campaign
// UI (core, plugin-gated), not by a global widget host, so there's no mountWidget.
// mountConfig renders the connection settings + a live "Test connection" that calls
// the plugin's testConnection backend action, and a campaigns lister.

export default {
    mountConfig(el, host) {
        const cfg = {
            apiKey: '',
            accountId: '',
            apiBaseUrl: 'https://api.givebutter.com/v1',
            defaultWidgetType: 'giving-form',
            ...(host.config || {}),
        };
        el.innerHTML = '';

        // Admin-styled form builders provided by the host (bound to `cfg`), so
        // this plugin doesn't redefine group/input/select.
        const { group, input, select } = host.ui.form(cfg);

        el.appendChild(group('GiveButter API key', input('apiKey', 'password'), 'From GiveButter → Settings → API. Stored server-side only; never sent to the browser.'));
        el.appendChild(group('Widget Account ID', input('accountId'), 'From GiveButter → Settings → Integrations → Widgets. Used by the public donation widget script.'));
        el.appendChild(group('API base URL', input('apiBaseUrl', 'url'), 'Default https://api.givebutter.com/v1 — change only for a proxy/sandbox.'));
        el.appendChild(group('Default widget', select('defaultWidgetType', ['giving-form', 'button', 'goal-bar'])));

        const status = document.createElement('div'); status.className = 'text-muted text-sm'; status.style.marginTop = '.5em';
        const list = document.createElement('div'); list.className = 'text-sm'; list.style.marginTop = '.5em';

        const actions = document.createElement('div'); actions.className = 'form-actions';

        const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-primary'; saveBtn.textContent = 'Save configuration';
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true; status.textContent = 'Saving…';
            try { await host.saveConfig(cfg); status.textContent = 'Saved ✓'; }
            catch (e) { status.textContent = 'Save failed: ' + (e && e.message); }
            finally { saveBtn.disabled = false; }
        });

        const testBtn = document.createElement('button'); testBtn.className = 'btn btn-secondary'; testBtn.textContent = 'Test connection';
        testBtn.addEventListener('click', async () => {
            status.textContent = 'Testing…'; list.textContent = '';
            try {
                await host.saveConfig(cfg); // persist first so the server action uses the current key
                const r = await host.api.post('/action/testConnection', {});
                status.textContent = r && r.ok
                    ? `Connected ✓ (account ${r.accountId || '—'}, ${r.campaignCount} campaign(s) on page 1)`
                    : `Failed: ${(r && r.error) || 'unknown error'}`;
            } catch (e) { status.textContent = 'Test failed: ' + (e && e.message); }
        });

        const listBtn = document.createElement('button'); listBtn.className = 'btn btn-secondary'; listBtn.textContent = 'List campaigns';
        listBtn.addEventListener('click', async () => {
            status.textContent = 'Loading…'; list.textContent = '';
            try {
                await host.saveConfig(cfg);
                const r = await host.api.post('/action/listCampaigns', {});
                if (!r || !r.ok) { status.textContent = `Failed: ${(r && r.error) || 'unknown error'}`; return; }
                status.textContent = `${r.campaigns.length} campaign(s):`;
                list.innerHTML = '';
                for (const c of r.campaigns) {
                    const row = document.createElement('div');
                    row.textContent = `${c.code || '—'} — ${c.title || '(untitled)'} (id ${c.id})`;
                    list.appendChild(row);
                }
            } catch (e) { status.textContent = 'Load failed: ' + (e && e.message); }
        });

        actions.appendChild(saveBtn); actions.appendChild(testBtn); actions.appendChild(listBtn);
        el.appendChild(actions); el.appendChild(status); el.appendChild(list);
    },
};
