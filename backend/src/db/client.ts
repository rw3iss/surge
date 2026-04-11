import { Pool, PoolClient, QueryResult, QueryResultRow, } from 'pg';
import { config, } from '../config';
import { logger, } from '../utils/logger';

const pool = new Pool({
    connectionString: config.database.url,
    min: config.database.poolMin,
    max: config.database.poolMax,
},);

pool.on('error', (err,) => {
    logger.error('Unexpected database pool error', { error: err.message, },);
},);

export async function query<T extends QueryResultRow = QueryResultRow,>(
    text: string,
    params?: unknown[],
): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
        const result = await pool.query<T>(text, params,);
        const duration = Date.now() - start;
        logger.debug('Executed query', { text: text.substring(0, 100,), duration, rows: result.rowCount, },);
        return result;
    } catch (error) {
        logger.error('Database query error', { text: text.substring(0, 100,), error, },);
        throw error;
    }
}

export async function getClient(): Promise<PoolClient> {
    const client = await pool.connect();
    const originalQuery = client.query.bind(client,);
    const originalRelease = client.release.bind(client,);

    const timeout = setTimeout(() => {
        logger.error('Database client has been checked out for more than 30 seconds',);
    }, 30000,);

    client.release = () => {
        clearTimeout(timeout,);
        return originalRelease();
    };

    client.query = ((...args: Parameters<typeof originalQuery>) => {
        return originalQuery(...args,);
    }) as typeof client.query;

    return client;
}

export async function transaction<T,>(
    callback: (client: PoolClient,) => Promise<T>,
): Promise<T> {
    const client = await getClient();
    try {
        await client.query('BEGIN',);
        const result = await callback(client,);
        await client.query('COMMIT',);
        return result;
    } catch (error) {
        await client.query('ROLLBACK',);
        throw error;
    } finally {
        client.release();
    }
}

export async function healthCheck(): Promise<boolean> {
    try {
        await query('SELECT 1',);
        return true;
    } catch {
        return false;
    }
}

export async function closePool(): Promise<void> {
    // pool.end() waits for in-flight queries and idle clients to close. If a
    // query is stuck (e.g. DB was restarted mid-connection), this can block
    // longer than the shutdown deadline, so we race against a short timeout
    // and fall through regardless.
    const CLOSE_TIMEOUT_MS = 800;
    await Promise.race([
        pool.end(),
        new Promise<void>((resolve,) => setTimeout(resolve, CLOSE_TIMEOUT_MS,)),
    ],);
}

export { pool, };
