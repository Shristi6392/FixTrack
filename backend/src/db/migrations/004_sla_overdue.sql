ALTER TABLE tickets ADD COLUMN is_overdue BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_tickets_due ON tickets(due_at) WHERE deleted_at IS NULL;
