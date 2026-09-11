-- 0059: Database-level foreign keys for relationships that were previously
-- declared only as indexed text columns in schema.ts (transactions.userId,
-- kyc_notes.userId/adminId, and the trading tables' user references).
--
-- Every constraint is preceded by an orphan pre-check: if reference rows are
-- missing, the migration ABORTS with the offending table named instead of
-- half-succeeding. Migrations run inside a transaction, so a failed check
-- leaves no partial state.

DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM transactions t LEFT JOIN users u ON t.user_id = u.id
  WHERE u.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'FK pre-check failed: % orphaned row(s) in transactions.user_id — resolve before adding constraints', orphan_count;
  END IF;
END $$;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id);

DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM kyc_notes n LEFT JOIN users u ON n.user_id = u.id
  WHERE u.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'FK pre-check failed: % orphaned row(s) in kyc_notes.user_id', orphan_count;
  END IF;
END $$;
ALTER TABLE kyc_notes
  ADD CONSTRAINT kyc_notes_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id);

DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM kyc_notes n LEFT JOIN admins a ON n.admin_id = a.id
  WHERE a.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'FK pre-check failed: % orphaned row(s) in kyc_notes.admin_id', orphan_count;
  END IF;
END $$;
ALTER TABLE kyc_notes
  ADD CONSTRAINT kyc_notes_admin_id_fk FOREIGN KEY (admin_id) REFERENCES admins(id);

DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM trading_positions p LEFT JOIN users u ON p.user_id = u.id
  WHERE u.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'FK pre-check failed: % orphaned row(s) in trading_positions.user_id', orphan_count;
  END IF;
END $$;
ALTER TABLE trading_positions
  ADD CONSTRAINT trading_positions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id);

DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM trading_orders o LEFT JOIN users u ON o.user_id = u.id
  WHERE u.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'FK pre-check failed: % orphaned row(s) in trading_orders.user_id', orphan_count;
  END IF;
END $$;
ALTER TABLE trading_orders
  ADD CONSTRAINT trading_orders_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id);

DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM trading_trades t LEFT JOIN users u ON t.user_id = u.id
  WHERE u.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'FK pre-check failed: % orphaned row(s) in trading_trades.user_id', orphan_count;
  END IF;
END $$;
ALTER TABLE trading_trades
  ADD CONSTRAINT trading_trades_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id);

DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM trading_trades t LEFT JOIN trading_orders o ON t.order_id = o.id
  WHERE o.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'FK pre-check failed: % orphaned row(s) in trading_trades.order_id', orphan_count;
  END IF;
END $$;
ALTER TABLE trading_trades
  ADD CONSTRAINT trading_trades_order_id_fk FOREIGN KEY (order_id) REFERENCES trading_orders(id);

DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM trading_watchlist w LEFT JOIN users u ON w.user_id = u.id
  WHERE u.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'FK pre-check failed: % orphaned row(s) in trading_watchlist.user_id', orphan_count;
  END IF;
END $$;
ALTER TABLE trading_watchlist
  ADD CONSTRAINT trading_watchlist_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id);