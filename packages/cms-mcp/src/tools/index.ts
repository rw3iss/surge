/**
 * Assembles every tool group into the flat registry the server registers.
 * Phases B–E append their groups here (pages, posts, blockStyles, appearance,
 * layout, settings, media, navigation, reference).
 */
import type { ToolDef, } from '../tool';
import { metaTools, } from './meta';
import { pageTools, } from './pages';
import { postTools, } from './posts';

export function allTools(): ToolDef[] {
    return [
        ...metaTools,
        ...pageTools,
        ...postTools,
    ];
}
