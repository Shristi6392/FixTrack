CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','technician','admin')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locations (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL CHECK (type IN ('block','floor','room')),
  parent_id INTEGER REFERENCES locations(id) ON DELETE CASCADE
);
CREATE INDEX idx_locations_parent ON locations(parent_id);
