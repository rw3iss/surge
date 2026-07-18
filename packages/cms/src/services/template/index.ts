/**
 * Content-block `{{ … }}` template engine — public API.
 *
 * `renderTemplate(src, runtime)` → ordered `OutputNode[]` (HTML strings +
 * whole-entity segments). Parsing is cached per-source (pure + deterministic).
 * A parse error degrades gracefully: the original source is returned verbatim
 * (a single html node) + a warning, so a typo never blanks a whole block.
 */
import { evaluate } from './evaluator';
import { parse } from './parser';
import { hasTemplateSyntax } from './tokenizer';
import type { Node, OutputNode, TemplateRuntime } from './types';
import { TemplateParseError } from './types';

export type { OutputNode, TemplateRuntime } from './types';
export { entityRef, isEntityRef } from './types';
export { hasTemplateSyntax } from './tokenizer';
export { parse } from './parser';

const astCache = new Map<string, Node[]>();

function getAst(src: string): Node[] {
    let ast = astCache.get(src);
    if (!ast) {
        ast = parse(src);
        // Bound the cache so a long-lived SPA session doesn't leak unbounded.
        if (astCache.size > 500) astCache.clear();
        astCache.set(src, ast);
    }
    return ast;
}

export async function renderTemplate(src: string, runtime: TemplateRuntime): Promise<OutputNode[]> {
    if (!hasTemplateSyntax(src)) return [{ type: 'html', html: src }];
    let ast: Node[];
    try {
        ast = getAst(src);
    } catch (e) {
        if (e instanceof TemplateParseError) {
            runtime.warn?.(`template: parse error — ${e.message} (block left un-templated)`);
            return [{ type: 'html', html: src }];
        }
        throw e;
    }
    return evaluate(ast, runtime);
}
