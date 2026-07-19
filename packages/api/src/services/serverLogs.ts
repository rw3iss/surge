/**
 * Read the tail of the server's combined log for the admin diagnostics panel.
 * Winston writes `logs/combined.log` (relative to the process cwd) in
 * production — see utils/logger.ts. Admin-only; surfaced via GET
 * /settings/server-logs.
 */
import { promises as fs, } from 'fs';
import path from 'path';

/** Never read more than the last chunk of the file, however large it grows. */
const MAX_BYTES = 512 * 1024;
const DEFAULT_LINES = 2000;
const MAX_LINES = 10000;

export interface ServerLogsResult {
    content: string;
    /** Absolute path read (or attempted). */
    file: string;
    /** Full file size in bytes. */
    bytes: number;
    /** True when older lines were dropped (byte cap or line cap). */
    truncated: boolean;
    /** False when no log file exists (e.g. dev/console-only logging). */
    available: boolean;
}

export async function getServerLogs(lines = DEFAULT_LINES,): Promise<ServerLogsResult> {
    const want = Math.min(Math.max(1, Math.trunc(lines,) || DEFAULT_LINES,), MAX_LINES,);
    const file = path.join(process.cwd(), 'logs', 'combined.log',);

    try {
        const stat = await fs.stat(file,);
        const start = Math.max(0, stat.size - MAX_BYTES,);
        const fh = await fs.open(file, 'r',);
        try {
            const length = stat.size - start;
            const buf = Buffer.alloc(length,);
            await fh.read(buf, 0, length, start,);
            let text = buf.toString('utf8',);
            // Started mid-file → drop the partial first line.
            let truncated = start > 0;
            if (truncated) {
                const nl = text.indexOf('\n',);
                if (nl >= 0) text = text.slice(nl + 1,);
            }
            const all = text.split('\n',);
            if (all.length > want) truncated = true;
            const content = all.slice(Math.max(0, all.length - want,),).join('\n',);
            return { content, file, bytes: stat.size, truncated, available: true, };
        } finally {
            await fh.close();
        }
    } catch {
        return { content: '', file, bytes: 0, truncated: false, available: false, };
    }
}
