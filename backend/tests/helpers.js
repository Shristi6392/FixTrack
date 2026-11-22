const request = require('supertest');
const bcrypt = require('bcryptjs');
const migrate = require('../src/db/migrate');
const { pool, query } = require('../src/db/pool');
const app = require('../src/app');

async function resetDb() {
  await migrate();
  const { rows } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'schema_migrations'");
  if (rows.length) await pool.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(',')} RESTART IDENTITY CASCADE`);
}

// Creates a user directly (any role) and returns { user, token } via real login.
async function makeUser(role = 'student', email = `${role}@test.com`) {
  const hash = await bcrypt.hash('password123', 4);
  await query('INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,$4)', [role, email, hash, role]);
  const res = await request(app).post('/auth/login').send({ email, password: 'password123' });
  return { user: res.body.user, token: res.body.token };
}
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

module.exports = { app, request, resetDb, makeUser, bearer, pool, query };
