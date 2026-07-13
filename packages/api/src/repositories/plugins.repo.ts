/** Data access for the `plugins` table. */
import { query } from '../db';
import { mapRow, mapRows } from '../utils/mapRow';
import type { Plugin, PluginManifest, PluginSource } from '@sitesurge/types';

const COLS = `id, name, label, version, installed_version, source, location,
    installed, enabled, config, manifest, error, created_at, updated_at`;

export async function listPlugins(): Promise<Plugin[]> {
    const r = await query(`SELECT ${COLS} FROM plugins ORDER BY label ASC`);
    return mapRows<Plugin>(r.rows);
}

export async function getByName(name: string): Promise<Plugin | null> {
    const r = await query(`SELECT ${COLS} FROM plugins WHERE name = $1`, [name]);
    return r.rows[0] ? mapRow<Plugin>(r.rows[0]) : null;
}

export async function insertDiscovered(input: {
    name: string;
    label: string;
    version: string;
    source: PluginSource;
    location: string;
    manifest: PluginManifest;
}): Promise<Plugin> {
    const r = await query(
        `INSERT INTO plugins (name, label, version, source, location, manifest)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING ${COLS}`,
        [input.name, input.label, input.version, input.source, input.location, JSON.stringify(input.manifest)],
    );
    return mapRow<Plugin>(r.rows[0]);
}

/** Reconcile disk-derived fields (version/label/manifest) after a rescan. */
export async function reconcileManifest(
    name: string,
    input: { version: string; label: string; manifest: PluginManifest },
): Promise<Plugin> {
    const r = await query(
        `UPDATE plugins SET version = $2, label = $3, manifest = $4::jsonb
         WHERE name = $1 RETURNING ${COLS}`,
        [name, input.version, input.label, JSON.stringify(input.manifest)],
    );
    return mapRow<Plugin>(r.rows[0]);
}

export async function setInstalled(name: string, installedVersion: string): Promise<Plugin> {
    const r = await query(
        `UPDATE plugins SET installed = true, installed_version = $2, error = NULL
         WHERE name = $1 RETURNING ${COLS}`,
        [name, installedVersion],
    );
    return mapRow<Plugin>(r.rows[0]);
}

export async function setEnabled(name: string, enabled: boolean): Promise<Plugin> {
    const r = await query(
        `UPDATE plugins SET enabled = $2 WHERE name = $1 RETURNING ${COLS}`,
        [name, enabled],
    );
    return mapRow<Plugin>(r.rows[0]);
}

export async function setConfig(name: string, cfg: Record<string, unknown>): Promise<Plugin> {
    const r = await query(
        `UPDATE plugins SET config = $2::jsonb WHERE name = $1 RETURNING ${COLS}`,
        [name, JSON.stringify(cfg)],
    );
    return mapRow<Plugin>(r.rows[0]);
}

export async function setError(name: string, error: string | null): Promise<Plugin | null> {
    const r = await query(
        `UPDATE plugins SET error = $2 WHERE name = $1 RETURNING ${COLS}`,
        [name, error],
    );
    return r.rows[0] ? mapRow<Plugin>(r.rows[0]) : null;
}

export async function deleteByName(name: string): Promise<void> {
    await query('DELETE FROM plugins WHERE name = $1', [name]);
}
