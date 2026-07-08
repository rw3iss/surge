import type { NextFunction, Request, Response, } from 'express';
import type { FeatureKey, } from '../features/registry';
import { isFeatureEnabledServer, } from '../services/settings';

/** Route guard: 404 the request when `feature` is disabled, so a
 *  disabled feature's endpoints behave as if they don't exist. */
export function requireFeature(feature: FeatureKey,) {
    return async (_req: Request, res: Response, next: NextFunction,) => {
        try {
            if (await isFeatureEnabledServer(feature,)) return next();
        } catch { /* fall through to 404 */ }
        res.status(404,).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found', }, },);
    };
}
