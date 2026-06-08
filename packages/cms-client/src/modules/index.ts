// packages/cms-client/src/modules/index.ts (stub — grows per batch)
import type { CmsClientCore, } from '../core/client';
export interface CmsModules {}
export function assembleModules(core: CmsClientCore,): CmsClientCore & CmsModules { return core as never; }
