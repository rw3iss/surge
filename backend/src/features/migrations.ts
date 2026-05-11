/**
 * Lazy-install migration applier. Runs a feature's tagged migrations
 * the first time the feature is enabled (and only that feature's
 * migrations — global migrations run at boot).
 *
 * Advisory-locked on the feature key so two concurrent enable attempts
 * can't race. Failures roll back the caller's transaction so the
 * feature stays off if any of its migrations error.
 */
import fs from 'fs';
import path from 'path';
import type { PoolClient, } from 'pg';
import { logger, } from '../utils/logger';
import { parseFeatureHeader, } from '../db/migrator';
import { FEATURE_REGISTRY, FeatureKey, } from './registry';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations',);

/**
 * Apply any unapplied migrations for `key` using the caller-provided
 * transactional client. Must be called inside a `BEGIN` block — the
 * caller commits (and flips the `*_enabled` setting) only after this
 * returns successfully.
 */
export async function applyFeatureMigrations(
    key: FeatureKey,
    client: PoolClient,
): Promise<string[]> {
    const lockKey = `feature:${key}`;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey,],);

    const cfg = FEATURE_REGISTRY[key];
    const filenames = cfg.migrations ?? [];
    if (filenames.length === 0) return [];

    const appliedRes = await client.query<{ filename: string; }>(
        `SELECT filename FROM schema_migrations WHERE filename = ANY($1::text[])`,
        [filenames,],
    );
    const appliedSet = new Set(appliedRes.rows.map((r,) => r.filename,),);

    const ran: string[] = [];
    for (const filename of filenames) {
        if (appliedSet.has(filename,)) continue;
        const filePath = path.join(MIGRATIONS_DIR, filename,);
        if (!fs.existsSync(filePath,)) {
            throw new Error(`Feature ${key}: migration ${filename} not found at ${filePath}`,);
        }
        const sql = fs.readFileSync(filePath, 'utf-8',);
        const tag = parseFeatureHeader(sql,);
        if (tag && tag !== key) {
            throw new Error(
                `Migration ${filename} is tagged @feature ${tag} but listed under feature ${key}`,
            );
        }
        await client.query(sql,);
        await client.query(
            `INSERT INTO schema_migrations (filename, feature) VALUES ($1, $2)`,
            [filename, key,],
        );
        logger.info(`Applied feature migration: ${filename} (feature=${key})`,);
        ran.push(filename,);
    }
    return ran;
}
