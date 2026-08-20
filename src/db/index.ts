import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Global connection pool caching for Serverless environments
declare global {
  var _postgresPool: Pool | undefined;
  var _drizzleDb: any | undefined;
}

export const getPool = (): Pool => {
  if (!global._postgresPool) {
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      Boolean(process.env.VERCEL) ||
      Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

    const sslConfig = {
      rejectUnauthorized: false,
    };

    try {
      if (process.env.DATABASE_URL) {
        const dbUrl = process.env.DATABASE_URL;
        const isRemote =
          isProduction ||
          dbUrl.includes('supabase.co') ||
          dbUrl.includes('pooler.supabase.com') ||
          dbUrl.includes('sslmode') ||
          (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1'));

        global._postgresPool = new Pool({
          connectionString: dbUrl,
          ssl: isRemote ? sslConfig : false,
          max: isProduction ? 5 : 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
        });
      } else {
        const isRemoteHost =
          isProduction ||
          (Boolean(process.env.SQL_HOST) &&
            !process.env.SQL_HOST?.includes('localhost') &&
            !process.env.SQL_HOST?.includes('127.0.0.1'));

        global._postgresPool = new Pool({
          host: process.env.SQL_HOST || '127.0.0.1',
          user: process.env.SQL_USER || 'postgres',
          password: process.env.SQL_PASSWORD || '',
          database: process.env.SQL_DB_NAME || 'postgres',
          port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
          ssl: isRemoteHost ? sslConfig : false,
          max: isProduction ? 5 : 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
        });
      }

      global._postgresPool.on('error', (err) => {
        console.error('Unexpected error on idle SQL pool client:', err);
      });
    } catch (poolInitError) {
      console.error('PostgreSQL Pool initialization warning:', poolInitError);
      global._postgresPool = new Pool({
        max: 1,
        connectionTimeoutMillis: 3000,
      });
    }
  }
  return global._postgresPool;
};

export const getDb = () => {
  if (!global._drizzleDb) {
    try {
      const pool = getPool();
      global._drizzleDb = drizzle(pool, { schema });
    } catch (dbInitErr) {
      console.error('Drizzle DB initialization warning:', dbInitErr);
      const fallbackPool = new Pool();
      global._drizzleDb = drizzle(fallbackPool, { schema });
    }
  }
  return global._drizzleDb;
};

// Export db proxy that delegates all calls to getDb() lazily and safely
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const instance = getDb();
    const val = (instance as any)[prop];
    if (typeof val === 'function') {
      return val.bind(instance);
    }
    return val;
  },
});


