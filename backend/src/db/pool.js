const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://fixtrack:fixtrack@localhost:5432/fixtrack',
});

module.exports = { pool, query: (text, params) => pool.query(text, params) };
