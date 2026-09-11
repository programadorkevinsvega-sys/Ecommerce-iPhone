PRAGMA foreign_keys = ON;

-- Checkout now decrements stock atomically as part of the order transaction.
-- Reservations are no longer created by checkout, so legacy open reservation rows
-- must not later add stock back for orders that already consumed it.
UPDATE inventory_reservations
SET released_at = COALESCE(released_at, CURRENT_TIMESTAMP)
WHERE released_at IS NULL;
