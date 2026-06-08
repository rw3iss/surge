type Handler<T> = (payload: T) => void;

/** Minimal typed event emitter. Handlers are isolated — one throwing
 *  never blocks the others (errors are swallowed; the error bus is the
 *  place to observe failures). */
export class Emitter<Events extends Record<string, unknown>> {
    private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>>; } = {};

    on<K extends keyof Events>(event: K, handler: Handler<Events[K]>,): () => void {
        (this.handlers[event] ??= new Set()).add(handler,);
        return () => { this.handlers[event]?.delete(handler,); };
    }

    once<K extends keyof Events>(event: K, handler: Handler<Events[K]>,): () => void {
        const off = this.on(event, (payload,) => { off(); handler(payload,); },);
        return off;
    }

    emit<K extends keyof Events>(event: K, payload: Events[K],): void {
        for (const handler of this.handlers[event] ?? []) {
            try { handler(payload,); } catch { /* isolated */ }
        }
    }
}
