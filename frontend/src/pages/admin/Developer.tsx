import { Title, } from '@solidjs/meta';
import { Component, createResource, createSignal, For, Show, } from 'solid-js';
import { api, fetchCrons, } from '../../services/api';
import { useToast, } from '../../components/common/toast';

interface CronJob {
    name: string;
    schedule: string;
    description: string;
    lastRun: string | null;
    lastResult: 'success' | 'error' | null;
    lastError: string | null;
    nextRun: string | null;
    isRunning: boolean;
    registeredAt: string;
}

const AdminDeveloper: Component = () => {
    const toast = useToast();
    const [crons, { refetch, },] = createResource(async () => {
        const response = await fetchCrons();
        return response.success ? (response as any).data as CronJob[] : [];
    },);

    // ─── Sitemap regenerate ───
    const [sitemapBusy, setSitemapBusy,] = createSignal(false,);
    const [sitemapInfo, setSitemapInfo,] = createSignal<{ urlCount: number; bytes: number; regeneratedAt: string; } | null>(null,);

    const regenerateSitemap = async () => {
        setSitemapBusy(true,);
        try {
            const response = await api.post('/admin/sitemap/regenerate', {},);
            if (response.success) {
                const data = (response as any).data as { urlCount: number; bytes: number; regeneratedAt: string; };
                setSitemapInfo(data,);
                toast.success(`Sitemap rebuilt: ${data.urlCount} URLs (${(data.bytes / 1024).toFixed(1,)} KB)`,);
            } else {
                toast.error('Failed to regenerate sitemap',);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Failed to regenerate sitemap',);
        } finally {
            setSitemapBusy(false,);
        }
    };

    const formatDate = (iso: string | null,) => {
        if (!iso) return '--';
        return new Date(iso,).toLocaleString();
    };

    const statusBadge = (job: CronJob,) => {
        if (job.isRunning) return 'badge--info';
        if (job.lastResult === 'success') return 'badge--success';
        if (job.lastResult === 'error') return 'badge--danger';
        return 'badge--secondary';
    };

    const statusLabel = (job: CronJob,) => {
        if (job.isRunning) return 'Running';
        if (job.lastResult === 'success') return 'OK';
        if (job.lastResult === 'error') return 'Error';
        return 'Pending';
    };

    return (
        <div class="admin-developer">
            <Title>Developer - Admin - RW</Title>

            <div class="admin-header">
                <h1>Developer Tools</h1>
                <p class="admin-header__subtitle">System internals and scheduled jobs.</p>
            </div>

            <div class="admin-section">
                <div class="admin-section__header">
                    <h2>Sitemap</h2>
                    <a href="/sitemap.xml" target="_blank" rel="noopener" class="btn btn--small btn--ghost">
                        View /sitemap.xml ↗
                    </a>
                </div>
                <p class="text-muted" style={{ 'margin-top': 0, }}>
                    Auto-rebuilds when pages, posts, campaigns, or forms change.
                    Use the button to force a rebuild now (drops the Redis cache and
                    re-queries the DB).
                </p>
                <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', 'margin-top': '12px', }}>
                    <button
                        class="btn btn--secondary"
                        onClick={regenerateSitemap}
                        disabled={sitemapBusy()}
                    >
                        {sitemapBusy() ? 'Regenerating…' : 'Regenerate sitemap'}
                    </button>
                    <Show when={sitemapInfo()}>
                        {(info,) => (
                            <span class="text-muted" style={{ 'font-size': '0.85rem', }}>
                                {info().urlCount} URLs · {(info().bytes / 1024).toFixed(1,)} KB ·
                                rebuilt {new Date(info().regeneratedAt,).toLocaleTimeString()}
                            </span>
                        )}
                    </Show>
                </div>
            </div>

            <div class="admin-section">
                <div class="admin-section__header">
                    <h2>Scheduled Jobs</h2>
                    <button class="btn btn--small btn--secondary" onClick={() => refetch()}>
                        Refresh
                    </button>
                </div>

                <Show
                    when={!crons.loading}
                    fallback={<p class="text-muted">Loading cron jobs...</p>}
                >
                    <Show
                        when={crons()?.length}
                        fallback={<p class="text-muted">No cron jobs registered.</p>}
                    >
                        <div class="cron-table-wrapper">
                            <table class="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Schedule</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>Last Run</th>
                                        <th>Next Run</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={crons()}>
                                        {(job,) => (
                                            <tr>
                                                <td class="cron-name">{job.name}</td>
                                                <td>
                                                    <code>{job.schedule}</code>
                                                </td>
                                                <td>{job.description}</td>
                                                <td>
                                                    <span class={`badge badge--small ${statusBadge(job,)}`}>
                                                        {statusLabel(job,)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span class="cron-date">{formatDate(job.lastRun,)}</span>
                                                    <Show when={job.lastError}>
                                                        <span class="cron-error" title={job.lastError!}>
                                                            {job.lastError}
                                                        </span>
                                                    </Show>
                                                </td>
                                                <td>
                                                    <span class="cron-date">{formatDate(job.nextRun,)}</span>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </Show>
                </Show>
            </div>
        </div>
    );
};

export default AdminDeveloper;
