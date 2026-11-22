// Demo data: one admin, technician and student (password "password123"), locations and assets.
const bcrypt = require('bcryptjs');
const migrate = require('./migrate');
const { pool } = require('./pool');

async function seed() {
  await migrate();
  const hash = await bcrypt.hash('password123', 10);
  for (const [name, email, role] of [['Admin Warden', 'admin@fixtrack.dev', 'admin'], ['Ravi Technician', 'tech@fixtrack.dev', 'technician'], ['Asha Student', 'student@fixtrack.dev', 'student']]) {
    await pool.query('INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING', [name, email, hash, role]);
  }
  if ((await pool.query('SELECT 1 FROM locations LIMIT 1')).rowCount === 0) {
    const block = (await pool.query("INSERT INTO locations(name,type) VALUES ('Block A','block') RETURNING id")).rows[0].id;
    const floor = (await pool.query("INSERT INTO locations(name,type,parent_id) VALUES ('Floor 1','floor',$1) RETURNING id", [block])).rows[0].id;
    const room = (await pool.query("INSERT INTO locations(name,type,parent_id) VALUES ('Room 101','room',$1) RETURNING id", [floor])).rows[0].id;
    await pool.query("INSERT INTO assets(code,name,type,location_id) VALUES ('FAN-101','Ceiling fan','Fan',$1),('AC-101','Air conditioner','AC',$1) ON CONFLICT (code) DO NOTHING", [room]);
  }
  console.log('Seeded. Login: admin@fixtrack.dev / tech@fixtrack.dev / student@fixtrack.dev, password "password123"');
}

seed().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
