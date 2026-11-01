CREATE INDEX IF NOT EXISTS idx_carts_updated_at_id
  ON carts(updated_at,id);
