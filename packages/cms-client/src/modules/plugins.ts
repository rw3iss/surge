import type {
    PluginConfigBody,
    PluginConfigResponse,
    PluginEnabledListResponse,
    PluginGetResponse,
    PluginInstallResponse,
    PluginListResponse,
    PluginMarketplaceInstallResponse,
    PluginMarketplaceQuery,
    PluginMarketplaceResponse,
    PluginRescanResponse,
    PluginToggleResponse,
    PluginUpdateResponse,
    PluginUploadResponse,
} from '@sitesurge/types';
import { ModuleBase, } from './base';

/** /plugins namespace — admin plugin management + the inherent public read. */
export class PluginsModule extends ModuleBase {
    protected readonly module = 'plugins';

    /** GET /plugins/enabled — public projection the running site self-loads. */
    listEnabled(): Promise<PluginEnabledListResponse> {
        return this.get<PluginEnabledListResponse>('/plugins/enabled',);
    }

    /** GET /plugins (admin) — bare array for the table view. */
    list(): Promise<PluginListResponse> {
        return this.get<PluginListResponse>('/plugins',);
    }

    /** GET /plugins/:name (admin). */
    getByName(name: string,): Promise<PluginGetResponse> {
        return this.get<PluginGetResponse>('/plugins/:name', { params: { name, }, },);
    }

    /** POST /plugins/rescan — reconcile PLUGINS_DIR with the DB. */
    rescan(): Promise<PluginRescanResponse> {
        return this.mutate<PluginRescanResponse>('POST', '/plugins/rescan', { invalidates: ['plugins',], },);
    }

    /** POST /plugins/upload — multipart zip (field "file"). */
    upload(formData: FormData,): Promise<PluginUploadResponse> {
        return this.uploadForm<PluginUploadResponse>('/plugins/upload', formData, { invalidates: ['plugins',], },);
    }

    /** POST /plugins/:name/install. */
    install(name: string,): Promise<PluginInstallResponse> {
        return this.mutate<PluginInstallResponse>('POST', '/plugins/:name/install', { params: { name, }, invalidates: ['plugins',], },);
    }

    /** PUT /plugins/:name/config. */
    saveConfig(name: string, config: Record<string, unknown>,): Promise<PluginConfigResponse> {
        const body: PluginConfigBody = { config, };
        return this.mutate<PluginConfigResponse>('PUT', '/plugins/:name/config', { params: { name, }, body, invalidates: ['plugins',], },);
    }

    /** POST /plugins/:name/enable. */
    enable(name: string,): Promise<PluginToggleResponse> {
        return this.mutate<PluginToggleResponse>('POST', '/plugins/:name/enable', { params: { name, }, invalidates: ['plugins',], },);
    }

    /** POST /plugins/:name/disable. */
    disable(name: string,): Promise<PluginToggleResponse> {
        return this.mutate<PluginToggleResponse>('POST', '/plugins/:name/disable', { params: { name, }, invalidates: ['plugins',], },);
    }

    /** POST /plugins/:name/update. */
    update(name: string,): Promise<PluginUpdateResponse> {
        return this.mutate<PluginUpdateResponse>('POST', '/plugins/:name/update', { params: { name, }, invalidates: ['plugins',], },);
    }

    /** POST /plugins/:name/uninstall. */
    uninstall(name: string,): Promise<{ message: string; droppedTables: string[]; }> {
        return this.mutate('POST', '/plugins/:name/uninstall', { params: { name, }, body: { confirm: true, }, invalidates: ['plugins',], },);
    }

    /** POST /plugins/:name/action/:action — invoke a plugin-defined backend action. */
    action<T = unknown>(name: string, action: string, payload?: Record<string, unknown>,): Promise<T> {
        return this.mutate<T>('POST', '/plugins/:name/action/:action', {
            params: { name, action, },
            body: payload ?? {},
        },);
    }

    /** GET /plugins/marketplace (stubbed). */
    marketplaceSearch(query?: PluginMarketplaceQuery,): Promise<PluginMarketplaceResponse> {
        return this.get<PluginMarketplaceResponse>('/plugins/marketplace', { query: query as Record<string, unknown>, },);
    }

    /** POST /plugins/marketplace/:id/install (stubbed). */
    marketplaceInstall(id: string,): Promise<PluginMarketplaceInstallResponse> {
        return this.mutate<PluginMarketplaceInstallResponse>('POST', '/plugins/marketplace/:id/install', { params: { id, }, invalidates: ['plugins',], },);
    }
}
