import { neon } from '@neondatabase/serverless';

/**
 * Lazily-initialised SQL client.  Throws only when first called, not at
 * module-load time, so the app boots locally without DATABASE_URL.
 */
function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

let _sql: ReturnType<typeof neon> | undefined;

export const sql: ReturnType<typeof neon> = new Proxy({} as ReturnType<typeof neon>, {
  apply(_target, thisArg, args) {
    if (!_sql) _sql = getSql();
    return Reflect.apply(_sql as object as (...a: unknown[]) => unknown, thisArg, args);
  },
  get(_target, prop) {
    if (!_sql) _sql = getSql();
    return Reflect.get(_sql, prop);
  },
});
