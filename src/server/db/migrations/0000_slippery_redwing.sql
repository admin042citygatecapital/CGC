CREATE TABLE IF NOT EXISTS "access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"ts" timestamp DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"url" text NOT NULL,
	"status" integer NOT NULL,
	"duration" integer NOT NULL,
	"ip" text NOT NULL,
	"ua" text NOT NULL,
	"referer" text NOT NULL,
	"bytes" integer NOT NULL,
	"user_id" text,
	"threat" text NOT NULL,
	"threat_note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"ip" text NOT NULL,
	"ua" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"target_id" text,
	"details" jsonb,
	"ip" text,
	"ts" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(24, 8),
	"currency" text,
	"merchant" text,
	"description" text,
	"status" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"number_enc" text NOT NULL,
	"cvv_enc" text NOT NULL,
	"last4" text NOT NULL,
	"expiry" text NOT NULL,
	"cardholder_name" text NOT NULL,
	"type" text NOT NULL,
	"network" text NOT NULL,
	"status" text NOT NULL,
	"frozen" boolean NOT NULL,
	"spending_limit" numeric(24, 8),
	"pin" text,
	"color" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ip" text,
	"ua" text,
	"created_at" timestamp NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"admin_id" text NOT NULL,
	"admin_name" text,
	"note" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"expiry_months" integer NOT NULL,
	"renewal_reminder_days" integer NOT NULL,
	"auto_restrict_expired" boolean NOT NULL,
	"updated_at" timestamp NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_events" (
	"id" text PRIMARY KEY NOT NULL,
	"ts" timestamp NOT NULL,
	"actor" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"result" text NOT NULL,
	"ip" text NOT NULL,
	"ua" text NOT NULL,
	"device" text NOT NULL,
	"browser" text NOT NULL,
	"os" text NOT NULL,
	"country" text NOT NULL,
	"reason" text,
	"session_id" text,
	"duration" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text,
	"tags" jsonb,
	"subscribed_at" timestamp NOT NULL,
	"unsubscribed_at" timestamp,
	"sequence_step" integer DEFAULT 0 NOT NULL,
	"last_email_at" timestamp,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trading_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"side" text NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"filled_qty" numeric(24, 8) DEFAULT 0 NOT NULL,
	"price" numeric(24, 8),
	"stop_price" numeric(24, 8),
	"status" text DEFAULT 'pending' NOT NULL,
	"currency" text NOT NULL,
	"fee" numeric(24, 8) DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trading_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"side" text NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"avg_entry_price" numeric(24, 8) NOT NULL,
	"current_price" numeric(24, 8) NOT NULL,
	"unrealised_pnl" numeric(24, 8) NOT NULL,
	"realised_pnl" numeric(24, 8) NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp NOT NULL,
	"closed_at" timestamp,
	"currency" text NOT NULL,
	"leverage" numeric(24, 8) NOT NULL,
	"stop_loss" numeric(24, 8),
	"take_profit" numeric(24, 8)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trading_trades" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_id" text NOT NULL,
	"position_id" text,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"side" text NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"price" numeric(24, 8) NOT NULL,
	"fee" numeric(24, 8) NOT NULL,
	"currency" text NOT NULL,
	"pnl" numeric(24, 8),
	"executed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trading_watchlist" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"added_at" timestamp NOT NULL,
	CONSTRAINT "trading_watchlist_user_symbol_unique" UNIQUE("user_id","symbol")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"user_email" text NOT NULL,
	"amount" numeric(24, 8) NOT NULL,
	"currency" text NOT NULL,
	"reference" text NOT NULL,
	"description" text NOT NULL,
	"note" text,
	"wallet_address" text,
	"network" text,
	"tx_hash" text,
	"bank_name" text,
	"account_number" text,
	"routing_number" text,
	"swift_code" text,
	"approved_by" text,
	"approved_at" timestamp,
	"rejected_by" text,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"frozen_by" text,
	"frozen_at" timestamp,
	"admin_note" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"ip" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"country" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"kyc_status" text DEFAULT 'not_submitted' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verify_token" text,
	"email_verify_expiry" timestamp,
	"password_hash" text NOT NULL,
	"login_attempts" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp,
	"last_login_ip" text,
	"ip" text,
	"balance" numeric(24, 8) DEFAULT 0 NOT NULL,
	"bank_name" text,
	"bank_account_number" text,
	"bank_routing_number" text,
	"bank_swift" text,
	"bank_iban" text,
	"wallet_btc" text,
	"wallet_eth" text,
	"wallet_usdt" text,
	"wallet_sol" text,
	"avatar_url" text,
	"date_of_birth" text,
	"address" text,
	"city" text,
	"postal_code" text,
	"id_type" text,
	"id_number" text,
	"id_document_url" text,
	"kyc_submitted_at" timestamp,
	"kyc_approved_at" timestamp,
	"kyc_rejected_at" timestamp,
	"kyc_rejection_reason" text,
	"selfie_url" text,
	"approved_at" timestamp,
	"approved_by" text,
	"rejected_at" timestamp,
	"rejected_by" text,
	"rejection_reason" text,
	"primary_currency" text DEFAULT 'USD' NOT NULL,
	"account_tier" text DEFAULT 'personal' NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"locale" text,
	"timezone" text,
	"notification_prefs" jsonb,
	"beneficiaries" jsonb,
	"trusted_devices" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"network" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"qr_code" text,
	"min_deposit" numeric(24, 8) NOT NULL,
	"confirmations" integer NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "card_activity" ADD CONSTRAINT "card_activity_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "card_activity" ADD CONSTRAINT "card_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "kyc_notes" ADD CONSTRAINT "kyc_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "trading_orders" ADD CONSTRAINT "trading_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "trading_positions" ADD CONSTRAINT "trading_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "trading_trades" ADD CONSTRAINT "trading_trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "trading_trades" ADD CONSTRAINT "trading_trades_order_id_trading_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."trading_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "trading_trades" ADD CONSTRAINT "trading_trades_position_id_trading_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."trading_positions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "trading_watchlist" ADD CONSTRAINT "trading_watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	 WHEN duplicate_object THEN null;
END $$;