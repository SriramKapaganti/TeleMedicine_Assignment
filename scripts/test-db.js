const { Pool } = require('pg');

async function testConnection(name, connectionString) {
  console.log(`\nTesting: ${name}`);
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    const client = await pool.connect();
    console.log(`[SUCCESS] ${name} connected!`);
    const res = await client.query('SELECT 1 as result, NOW() as current_time');
    console.log(`[QUERY] ${name}:`, res.rows[0]);
    client.release();
    await pool.end();
    return true;
  } catch (err) {
    console.error(`[FAILED] ${name}:`, err.message);
    await pool.end().catch(() => {});
    return false;
  }
}

async function run() {
  // Option 1: URL without channel_binding
  const url1 = 'postgresql://neondb_owner:npg_myCg4TSJ1fWG@ep-weathered-smoke-b4iz5zn1-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
  // Option 2: Direct endpoint (without -pooler)
  const url2 = 'postgresql://neondb_owner:npg_myCg4TSJ1fWG@ep-weathered-smoke-b4iz5zn1.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
  // Option 3: With ssl query param
  const url3 = 'postgresql://neondb_owner:npg_myCg4TSJ1fWG@ep-weathered-smoke-b4iz5zn1-pooler.c-6.us-east-2.aws.neon.tech/neondb?ssl=true';

  await testConnection('Pooler without channel_binding', url1);
  await testConnection('Direct host without -pooler', url2);
  await testConnection('Pooler with ssl=true', url3);
}

run().then(() => process.exit(0));
