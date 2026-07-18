// Shopify plugin — framework-agnostic browser client (plain ESM, no build step).
// Only a config page: the storefront override is rendered by the CMS shop pages
// (core, plugin-gated) via the server actions, not by a global widget host.

export default {
    mountConfig(el, host) {
        const cfg = {
            shopDomain: '',
            storefrontToken: '',
            adminToken: '',
            apiVersion: '2024-10',
            ...(host.config || {}),
        };
        el.innerHTML = '';

        const group = (labelText, control, help) => {
            const g = document.createElement('div'); g.className = 'form-group';
            const l = document.createElement('label'); l.textContent = labelText; g.appendChild(l);
            if (help) { const h = document.createElement('div'); h.className = 'form-help-muted'; h.textContent = help; g.appendChild(h); }
            g.appendChild(control); return g;
        };
        const input = (key, type) => {
            const i = document.createElement('input'); i.className = 'input'; i.type = type || 'text';
            i.value = cfg[key] != null ? String(cfg[key]) : '';
            i.addEventListener('input', () => { cfg[key] = i.value; });
            return i;
        };

        el.appendChild(group('Shop domain', input('shopDomain'), 'e.g. my-store.myshopify.com'));
        el.appendChild(group('Storefront API access token', input('storefrontToken', 'password'), 'From the Headless / Storefront API app. Stored server-side only.'));
        el.appendChild(group('Admin API access token (optional)', input('adminToken', 'password'), 'shpat_… — enables the admin orders/stats dashboard. Server-side only.'));
        el.appendChild(group('API version', input('apiVersion'), 'YYYY-MM, default 2024-10.'));

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
                await host.saveConfig(cfg);
                const r = await host.api.post('/action/testConnection', {});
                status.textContent = r && r.ok
                    ? `Connected ✓ — ${r.shopName || 'store'} (admin API ${r.adminConfigured ? (r.adminOk ? 'ok' : 'FAILED') : 'not configured'})`
                    : `Failed: ${(r && r.error) || 'unknown error'}`;
            } catch (e) { status.textContent = 'Test failed: ' + (e && e.message); }
        });

        const previewBtn = document.createElement('button'); previewBtn.className = 'btn btn-secondary'; previewBtn.textContent = 'Preview products';
        previewBtn.addEventListener('click', async () => {
            status.textContent = 'Loading…'; list.textContent = '';
            try {
                await host.saveConfig(cfg);
                const r = await host.api.post('/action/listProducts', { limit: 5 });
                if (!r || !r.ok) { status.textContent = `Failed: ${(r && r.error) || 'unknown error'}`; return; }
                status.textContent = `${r.products.length} product(s):`;
                list.innerHTML = '';
                for (const p of r.products) {
                    const row = document.createElement('div');
                    row.textContent = `${p.title} (${p.slug})`;
                    list.appendChild(row);
                }
            } catch (e) { status.textContent = 'Load failed: ' + (e && e.message); }
        });

        actions.appendChild(saveBtn); actions.appendChild(testBtn); actions.appendChild(previewBtn);
        el.appendChild(actions); el.appendChild(status); el.appendChild(list);
    },
};
