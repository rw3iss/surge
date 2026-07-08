import type { PoolClient, } from 'pg';
import { applyFeatureMigrations, } from './migrations';
import { FEATURE_REGISTRY, FeatureKey, } from './registry';

/** Install a single feature inside the caller's transaction: run its
 *  migrations, then its idempotent onEnable hook. Returns the migration
 *  filenames that ran (for the client install status). */
export async function installFeatureStep(key: FeatureKey, client: PoolClient,): Promise<string[]> {
    const applied = await applyFeatureMigrations(key, client,);
    await FEATURE_REGISTRY[key].onEnable?.(client, key,);
    return applied;
}
