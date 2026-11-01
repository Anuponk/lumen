// Private PostgreSQL operator adapter. NEVER import this file into browser bundles.
// The connection string must be injected by the private host's secret store.
export async function createOperatorTransaction({ connectionString, connect }) {
  if (typeof connectionString !== 'string' || !connectionString.startsWith('postgresql://')) {
    throw new Error('Private PostgreSQL connection required');
  }
  if (typeof connect !== 'function') throw new Error('Private database connector required');
  return async function withOperatorTransaction(work) {
    const client = await connect(connectionString);
    let committed = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const role = await client.query('select current_user as role, auth.uid() as auth_uid');
      if (role.rows?.[0]?.role !== 'postgres' || role.rows?.[0]?.auth_uid != null) {
        throw new Error('Operator-only PostgreSQL session required');
      }
      const tx = {
        review: async (uid, actors) => {
          const result = await client.query('select lumen_privacy.review_erasure($1::uuid,$2::text[]) as report', [uid, actors]);
          return result.rows[0].report;
        },
        erase: async (uid, actors, confirmation) => {
          const result = await client.query('select lumen_privacy.erase_account($1::uuid,$2::text[],$3::text) as report', [uid, actors, confirmation]);
          return result.rows[0].report;
        }
      };
      const result = await work(tx);
      await client.query('COMMIT');
      committed = true;
      return result;
    } catch (error) {
      if (!committed) {
        try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
      }
      throw error;
    } finally {
      await client.end();
    }
  };
}
