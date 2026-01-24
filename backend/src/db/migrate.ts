import fs from 'fs';
import path from 'path';
import { pool } from './client';
import { logger } from '../utils/logger';

async function migrate() {
  const client = await pool.connect();

  try {
    logger.info('Starting database migration...');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute the schema
    await client.query(schema);

    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Database migration failed', { error });
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
