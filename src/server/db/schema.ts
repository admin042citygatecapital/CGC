/**
 * Drizzle ORM schema — City Gate Capital
 * Database: PostgreSQL (Neon serverless)
 *
 * Tables:
 *   users                 — customer accounts
 *   admin_sessions        — admin session token digests
 *   customer_sessions     — customer session token digests (separate from user record)
 *   transactions          — append-only financial ledger
 *   cards                 — virtual cards (PAN/CVV AES-256-GCM encrypted)
 *   card_activity         — card transaction log
 *   wallets               — admin-managed deposit addresses
 *   kyc_notes             — admin KYC review notes
 *   kyc_settings          — KYC configuration
 *   trading_positions     — open/closed trading positions
 *   trading_orders        — all orders
 *   trading_trades        — executed trade history (immutable)
 *   trading_watchlist     — per-user watchlist
 *   notifications         — per-user notification inbox
 *   support_conversations — customer support tickets
 *   support_messages      — messages within a conversation
 *   support_notes         — internal admin notes on tickets
 *   canned_responses      — admin canned reply templates
 *   login_events          — login audit log
 *   audit_log             — admin action audit trail
 *   config                — key/value app configuration
 *   email_queue           — outbound email queue
 *   subscribers           — newsletter subscribers
 */

import { pgTable, text, boolean, integer, bigint, numeric, doublePrecision, timestamp, date, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const userStatusEnum = pgEnum('user_status', ['pending_verification', 'pending_kyc', 'pending_approval', 'active', 'suspended', 'frozen', 'rejected']);

export const kycStatusEnum = pgEnum('kyc_status', ['not_submitted', 'submitted', 'approved', 'rejected']);

export const txTypeEnum = pgEnum('tx_type', ['deposit', 'withdrawal', 'transfer', 'crypto_buy', 'crypto_sell', 'wire_transfer', 'fee', 'refund', 'manual_credit', 'manual_debit']);

export const txStatusEnum = pgEnum('tx_status', ['pending', 'completed', 'failed', 'rejected', 'flagged', 'frozen']);

export const txCurrencyEnum = pgEnum('tx_currency', ['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'CHF', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'NGN']);

export const adminRoleEnum = pgEnum('admin_role', [
  'SUPER_ADMIN',
  'FINANCE_ADMIN',
  'SECURITY_ADMIN',
  'SUPPORT_ADMIN',
  'COMPLIANCE_ADMIN',
  'CONTENT_ADMIN',
  'OPERATIONS_ADMIN',
  'AUDITOR',
]);

export const orderSideEnum = pgEnum('order_side', ['buy', 'sell']);
export const orderTypeEnum = pgEnum('order_type', ['market', 'limit', 'stop', 'stop_limit']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'open', 'filled', 'partially_filled', 'cancelled', 'rejected', 'expired']);
export const positionStatusEnum = pgEnum('position_status', ['open', 'closed']);
export const assetClassEnum = pgEnum('asset_class', ['crypto', 'forex', 'stock', 'commodity', 'etf']);

export const supportPriorityEnum = pgEnum('support_priority', ['low', 'medium', 'high', 'urgent']);
export const supportStatusEnum = pgEnum('support_status', ['open', 'pending', 'in_progress', 'resolved', 'closed']);

export const loginActorEnum = pgEnum('login_actor', ['admin', 'user']);
export const loginResultEnum = pgEnum('login_result', ['success', 'failed', 'blocked', 'totp_failed', 'otp_sent', 'otp_failed', 'account_locked', 'status_denied']);

export const emailQueueStatusEnum = pgEnum('email_queue_status', ['queued', 'sending', 'sent', 'failed', 'cancelled']);

export const accountTierEnum = pgEnum('account_tier', ['personal', 'savings', 'business']);

export const sponsorEvidenceStatusEnum = pgEnum('sponsor_evidence_status', ['draft', 'submitted', 'approved', 'rejected', 'expired']);

export const sponsorPackageStatusEnum = pgEnum('sponsor_package_status', ['draft', 'submitted', 'approved', 'rejected']);

// ── users ─────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    country: text('country'),
    status: userStatusEnum('status').notNull().default('pending_verification'),
    kycStatus: kycStatusEnum('kyc_status').notNull().default('not_submitted'),
    // AML is an explicit compliance decision, separate from identity verification.
    // Only "cleared" permits a financial operation; all other values fail closed.
    amlStatus: text('aml_status').$type<'not_screened' | 'pending' | 'cleared' | 'review' | 'blocked'>().notNull().default('not_screened'),
    amlRiskLevel: text('aml_risk_level').$type<'unrated' | 'low' | 'medium' | 'high'>().notNull().default('unrated'),
    amlReviewedAt: timestamp('aml_reviewed_at', { withTimezone: true }),
    amlReviewedBy: text('aml_reviewed_by'),
    amlReviewReason: text('aml_review_reason'),
    amlNextReviewAt: timestamp('aml_next_review_at', { withTimezone: true }),
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerifyToken: text('email_verify_token'),
    emailVerifyExpiry: timestamp('email_verify_expiry', { withTimezone: true }),
    passwordHash: text('password_hash').notNull(),
    credentialVersion: integer('credential_version').notNull().default(1),
    loginAttempts: integer('login_attempts').notNull().default(0),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: text('last_login_ip'),
    ip: text('ip'),
    balance: numeric('balance', {
      precision: 20,
      scale: 2,
      mode: 'number',
    }).default(0),
    // Bank account
    bankName: text('bank_name'),
    bankAccountNumber: text('bank_account_number'),
    bankRoutingNumber: text('bank_routing_number'),
    bankSwift: text('bank_swift'),
    bankIban: text('bank_iban'),
    // Crypto withdrawal addresses
    walletBtc: text('wallet_btc'),
    walletEth: text('wallet_eth'),
    walletUsdt: text('wallet_usdt'),
    walletSol: text('wallet_sol'),
    // Avatar
    avatarUrl: text('avatar_url'),
    // KYC extended fields
    dateOfBirth: text('date_of_birth'),
    address: text('address'),
    city: text('city'),
    postalCode: text('postal_code'),
    idType: text('id_type'),
    idNumber: text('id_number'),
    idDocumentUrl: text('id_document_url'),
    kycSubmittedAt: timestamp('kyc_submitted_at', { withTimezone: true }),
    kycApprovedAt: timestamp('kyc_approved_at', { withTimezone: true }),
    kycExpiresAt: timestamp('kyc_expires_at', { withTimezone: true }),
    kycReviewedBy: text('kyc_reviewed_by'),
    kycReviewReason: text('kyc_review_reason'),
    kycRejectedAt: timestamp('kyc_rejected_at', { withTimezone: true }),
    kycRejectionReason: text('kyc_rejection_reason'),
    selfieUrl: text('selfie_url'),
    // Admin fields
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedBy: text('rejected_by'),
    rejectionReason: text('rejection_reason'),
    // Preferences
    primaryCurrency: text('primary_currency').default('USD'),
    accountTier: accountTierEnum('account_tier').default('personal'),
    requestedProduct: text('requested_product'),
    // Notification preferences (stored as JSONB)
    notificationPrefs: jsonb('notification_prefs'),
    // Beneficiaries (stored as JSONB array)
    beneficiaries: jsonb('beneficiaries'),
    // Trusted devices (stored as JSONB array)
    trustedDevices: jsonb('trusted_devices'),
    dataClassification: text('data_classification').notNull().default('customer'),
    quarantineBatchId: text('quarantine_batch_id'),
    quarantinedAt: timestamp('quarantined_at', { withTimezone: true }),
    // TOTP
    totpSecret: text('totp_secret'),
    totpEnabled: boolean('totp_enabled').default(false),
    totpRecoveryHashes: jsonb('totp_recovery_hashes').$type<string[]>(),
    // Locale/timezone/currency prefs
    locale: text('locale'),
    timezone: text('timezone'),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email), index('users_status_idx').on(t.status), index('users_kyc_status_idx').on(t.kycStatus), index('users_aml_status_idx').on(t.amlStatus), index('users_created_at_idx').on(t.createdAt), index('users_data_classification_idx').on(t.dataClassification)],
);

// ── admins ───────────────────────────────────────────────────────────────
// Staff/admin accounts. Completely separate from `users` (customers) — never merged.
export const admins = pgTable('admins', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  credentialVersion: integer('credential_version').notNull().default(1),
  name: text('name').notNull(),
  role: adminRoleEnum('role').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

// ── admin_sessions ────────────────────────────────────────────────────────────

export const adminSessions = pgTable(
  'admin_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    adminId: text('admin_id').notNull(),
    email: text('email').notNull(),
    role: adminRoleEnum('role').notNull(),
    credentialVersion: integer('credential_version').notNull().default(1),
    ip: text('ip').notNull(),
    ua: text('ua').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('admin_sessions_admin_id_idx').on(t.adminId), index('admin_sessions_expires_at_idx').on(t.expiresAt)],
);

// ── admin_otp_challenges ────────────────────────────────────────────────────
// Short-lived, single-use administrator verification challenges. The raw
// challenge identifier, OTP, IP address, and user-agent are never persisted.
export const adminOtpChallenges = pgTable(
  'admin_otp_challenges',
  {
    challengeIdHash: text('challenge_id_hash').primaryKey(),
    adminId: text('admin_id')
      .notNull()
      .references(() => admins.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    credentialVersion: integer('credential_version').notNull(),
    otpHash: text('otp_hash').notNull(),
    ipHash: text('ip_hash').notNull(),
    uaHash: text('ua_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    used: boolean('used').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  },
  (t) => [
    index('admin_otp_challenges_email_created_idx').on(t.email, t.createdAt),
    index('admin_otp_challenges_admin_id_idx').on(t.adminId),
    index('admin_otp_challenges_expires_at_idx').on(t.expiresAt),
  ],
);

// ── customer_sessions ─────────────────────────────────────────────────────────

export const customerSessions = pgTable(
  'customer_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialVersion: integer('credential_version').notNull().default(1),
    ip: text('ip'),
    ua: text('ua'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('customer_sessions_user_id_idx').on(t.userId), index('customer_sessions_expires_at_idx').on(t.expiresAt)],
);

// ── customer_password_reset_tokens ───────────────────────────────────────────
// Raw recovery tokens are delivered to the customer only. PostgreSQL stores a
// one-way fingerprint and consumes it atomically before changing a credential.

export const customerPasswordResetTokens = pgTable(
  'customer_password_reset_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialVersion: integer('credential_version').notNull().default(1),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('customer_password_reset_tokens_user_id_idx').on(t.userId),
    index('customer_password_reset_tokens_expires_at_idx').on(t.expiresAt),
  ],
);

// ── transactions ──────────────────────────────────────────────────────────────

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    type: txTypeEnum('type').notNull(),
    status: txStatusEnum('status').notNull().default('pending'),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    userName: text('user_name').notNull(),
    userEmail: text('user_email').notNull(),
    amount: numeric('amount', {
      precision: 30,
      scale: 8,
      mode: 'number',
    }).notNull(),
    currency: txCurrencyEnum('currency').notNull(),
    reference: text('reference').notNull(),
    idempotencyKey: text('idempotency_key'),
    idempotencyFingerprint: text('idempotency_fingerprint'),
    description: text('description').notNull(),
    note: text('note'),
    // Crypto fields
    walletAddress: text('wallet_address'),
    network: text('network'),
    txHash: text('tx_hash'),
    // Wire fields
    bankName: text('bank_name'),
    accountNumber: text('account_number'),
    routingNumber: text('routing_number'),
    swiftCode: text('swift_code'),
    // Admin fields
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: text('rejected_by'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    frozenBy: text('frozen_by'),
    frozenAt: timestamp('frozen_at', { withTimezone: true }),
    adminNote: text('admin_note'),
    flagged: boolean('flagged').notNull().default(false),
    dataClassification: text('data_classification').notNull().default('application_record'),
    quarantineBatchId: text('quarantine_batch_id'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('transactions_user_id_idx').on(t.userId), index('transactions_status_idx').on(t.status), index('transactions_type_idx').on(t.type), index('transactions_created_at_idx').on(t.createdAt), index('transactions_flagged_idx').on(t.flagged), index('transactions_data_classification_idx').on(t.dataClassification), uniqueIndex('transactions_reference_idx').on(t.reference), uniqueIndex('transactions_user_idempotency_idx').on(t.userId, t.idempotencyKey)],
);

// ── cards ─────────────────────────────────────────────────────────────────────

export const cards = pgTable(
  'cards',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // PAN and CVV stored as "enc:<iv>:<authTag>:<ciphertext>" (AES-256-GCM)
    numberEnc: text('number_enc').notNull(),
    cvvEnc: text('cvv_enc').notNull(),
    last4: text('last4').notNull(),
    expiry: text('expiry').notNull(),
    cardholderName: text('cardholder_name').notNull(),
    type: text('type').notNull().default('virtual'),
    network: text('network').notNull().default('Visa'),
    status: text('status').notNull().default('active'),
    frozen: boolean('frozen').notNull().default(false),
    spendingLimit: numeric('spending_limit', {
      precision: 20,
      scale: 2,
      mode: 'number',
    }),
    pin: text('pin'),
    color: text('color').default('#1a1a2e'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('cards_user_id_idx').on(t.userId), index('cards_status_idx').on(t.status)],
);

// ── card_activity ─────────────────────────────────────────────────────────────

export const cardActivity = pgTable(
  'card_activity',
  {
    id: text('id').primaryKey(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    amount: numeric('amount', { precision: 20, scale: 2, mode: 'number' }),
    currency: text('currency'),
    merchant: text('merchant'),
    description: text('description'),
    status: text('status').notNull().default('completed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('card_activity_card_id_idx').on(t.cardId), index('card_activity_user_id_idx').on(t.userId)],
);

// ── wallets ───────────────────────────────────────────────────────────────────

export const wallets = pgTable('wallets', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  network: text('network').notNull(),
  address: text('address').notNull().default(''),
  qrCode: text('qr_code'),
  minDeposit: numeric('min_deposit', {
    precision: 30,
    scale: 8,
    mode: 'number',
  })
    .notNull()
    .default(0),
  confirmations: integer('confirmations').notNull().default(1),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by'),
});

// ── kyc_notes ─────────────────────────────────────────────────────────────────

export const kycNotes = pgTable(
  'kyc_notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    adminId: text('admin_id').notNull().references(() => admins.id, { onDelete: 'restrict' }),
    adminName: text('admin_name'),
    note: text('note').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('kyc_notes_user_id_idx').on(t.userId)],
);

// ── kyc_settings ──────────────────────────────────────────────────────────────

export const kycSettings = pgTable('kyc_settings', {
  id: integer('id').primaryKey().default(1),
  expiryMonths: integer('expiry_months').notNull().default(12),
  renewalReminderDays: integer('renewal_reminder_days').notNull().default(30),
  autoRestrictExpired: boolean('auto_restrict_expired').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by'),
});

// ── trading_positions ─────────────────────────────────────────────────────────

export const tradingPositions = pgTable(
  'trading_positions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    symbol: text('symbol').notNull(),
    assetClass: assetClassEnum('asset_class').notNull(),
    side: orderSideEnum('side').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    avgEntryPrice: doublePrecision('avg_entry_price').notNull(),
    currentPrice: doublePrecision('current_price').notNull(),
    unrealisedPnl: doublePrecision('unrealised_pnl').notNull().default(0),
    realisedPnl: doublePrecision('realised_pnl').notNull().default(0),
    status: positionStatusEnum('status').notNull().default('open'),
    currency: text('currency').notNull().default('USD'),
    leverage: doublePrecision('leverage').notNull().default(1),
    stopLoss: doublePrecision('stop_loss'),
    takeProfit: doublePrecision('take_profit'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [index('trading_positions_user_id_idx').on(t.userId), index('trading_positions_status_idx').on(t.status), index('trading_positions_symbol_idx').on(t.symbol)],
);

// ── trading_orders ────────────────────────────────────────────────────────────

export const tradingOrders = pgTable(
  'trading_orders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    symbol: text('symbol').notNull(),
    assetClass: assetClassEnum('asset_class').notNull(),
    side: orderSideEnum('side').notNull(),
    type: orderTypeEnum('type').notNull(),
    status: orderStatusEnum('status').notNull().default('pending'),
    quantity: doublePrecision('quantity').notNull(),
    price: doublePrecision('price'),
    stopPrice: doublePrecision('stop_price'),
    filledQty: doublePrecision('filled_qty').notNull().default(0),
    avgFillPrice: doublePrecision('avg_fill_price'),
    fee: doublePrecision('fee').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    positionId: text('position_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [index('trading_orders_user_id_idx').on(t.userId), index('trading_orders_status_idx').on(t.status), index('trading_orders_symbol_idx').on(t.symbol)],
);

// ── trading_trades ────────────────────────────────────────────────────────────

export const tradingTrades = pgTable(
  'trading_trades',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    orderId: text('order_id').notNull(),
    // order_id is enforced at the database level by migration 0059.
    positionId: text('position_id'),
    symbol: text('symbol').notNull(),
    assetClass: assetClassEnum('asset_class').notNull(),
    side: orderSideEnum('side').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    price: doublePrecision('price').notNull(),
    fee: doublePrecision('fee').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    pnl: doublePrecision('pnl'),
    executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('trading_trades_user_id_idx').on(t.userId), index('trading_trades_symbol_idx').on(t.symbol), index('trading_trades_executed_at_idx').on(t.executedAt)],
);

// ── trading_watchlist ─────────────────────────────────────────────────────────

export const tradingWatchlist = pgTable(
  'trading_watchlist',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    symbol: text('symbol').notNull(),
    assetClass: assetClassEnum('asset_class').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('trading_watchlist_user_id_idx').on(t.userId), uniqueIndex('trading_watchlist_user_symbol_idx').on(t.userId, t.symbol)],
);

// ── notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    link: text('link'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_id_idx').on(t.userId), index('notifications_read_idx').on(t.read), index('notifications_created_at_idx').on(t.createdAt)],
);

// ── support_conversations ─────────────────────────────────────────────────────

export const supportConversations = pgTable(
  'support_conversations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    userName: text('user_name').notNull(),
    userEmail: text('user_email').notNull(),
    subject: text('subject').notNull(),
    category: text('category').notNull(),
    priority: supportPriorityEnum('priority').notNull().default('medium'),
    status: supportStatusEnum('status').notNull().default('open'),
    assignedTo: text('assigned_to'),
    firstReplyAt: timestamp('first_reply_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_conversations_user_id_idx').on(t.userId), index('support_conversations_status_idx').on(t.status), index('support_conversations_created_at_idx').on(t.createdAt)],
);

// ── support_messages ──────────────────────────────────────────────────────────

export const supportMessages = pgTable(
  'support_messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => supportConversations.id, { onDelete: 'cascade' }),
    from: text('from').notNull(), // 'customer' | 'admin'
    text: text('text').notNull(),
    adminName: text('admin_name'),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_messages_conversation_id_idx').on(t.conversationId)],
);

// ── support_notes ─────────────────────────────────────────────────────────────

export const supportNotes = pgTable(
  'support_notes',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => supportConversations.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    adminId: text('admin_id').notNull(),
    adminName: text('admin_name'),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_notes_conversation_id_idx').on(t.conversationId)],
);

// ── canned_responses ──────────────────────────────────────────────────────────

export const cannedResponses = pgTable('canned_responses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  category: text('category').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── login_events ──────────────────────────────────────────────────────────────

export const loginEvents = pgTable(
  'login_events',
  {
    id: text('id').primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    actor: loginActorEnum('actor').notNull(),
    email: text('email').notNull(),
    userId: text('user_id'),
    result: loginResultEnum('result').notNull(),
    ip: text('ip').notNull(),
    ua: text('ua').notNull(),
    device: text('device').notNull(),
    browser: text('browser').notNull(),
    os: text('os').notNull(),
    country: text('country').notNull(),
    reason: text('reason'),
    sessionId: text('session_id'),
    duration: integer('duration'),
  },
  (t) => [index('login_events_email_idx').on(t.email), index('login_events_user_id_idx').on(t.userId), index('login_events_ts_idx').on(t.ts), index('login_events_result_idx').on(t.result)],
);

// ── audit_log ─────────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    adminId: text('admin_id').notNull(),
    adminEmail: text('admin_email').notNull(),
    action: text('action').notNull(),
    target: text('target'),
    targetId: text('target_id'),
    details: jsonb('details'),
    ip: text('ip'),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_admin_id_idx').on(t.adminId), index('audit_log_ts_idx').on(t.ts), index('audit_log_action_idx').on(t.action)],
);

// ── config ────────────────────────────────────────────────────────────────────

export const config = pgTable('config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by'),
});

// ── email_queue ───────────────────────────────────────────────────────────────

export const emailQueue = pgTable(
  'email_queue',
  {
    id: text('id').primaryKey(),
    to: text('to').notNull(),
    subject: text('subject').notNull(),
    html: text('html').notNull(),
    from: text('from'),
    replyTo: text('reply_to'),
    status: emailQueueStatusEnum('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastError: text('last_error'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('email_queue_status_idx').on(t.status), index('email_queue_scheduled_at_idx').on(t.scheduledAt)],
);

// Signed provider delivery events. This is deliberately metadata-only: email
// bodies, recipients, subjects, webhook signatures, and provider secrets are
// never persisted. Event IDs provide replay protection.
export const emailProviderEvents = pgTable(
  'email_provider_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    messageId: text('message_id').notNull(),
    eventType: text('event_type').$type<'sent' | 'scheduled' | 'delivered' | 'delivery_delayed' | 'complained' | 'bounced' | 'opened' | 'clicked' | 'failed' | 'suppressed'>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    payloadSha256: text('payload_sha256').notNull(),
  },
  (t) => [index('email_provider_events_message_idx').on(t.messageId, t.occurredAt), index('email_provider_events_type_idx').on(t.eventType, t.occurredAt), uniqueIndex('email_provider_events_provider_id_idx').on(t.provider, t.id)],
);

// ── access_log ────────────────────────────────────────────────────────────────

export const accessLog = pgTable(
  'access_log',
  {
    id: text('id').primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    method: text('method').notNull(),
    url: text('url').notNull(),
    status: integer('status').notNull(),
    duration: integer('duration').notNull().default(0),
    ip: text('ip').notNull(),
    ua: text('ua').notNull().default(''),
    referer: text('referer').notNull().default(''),
    bytes: integer('bytes').notNull().default(0),
    userId: text('user_id'),
    threat: text('threat').notNull().default('none'),
    threatNote: text('threat_note').notNull().default(''),
  },
  (t) => [index('access_log_ts_idx').on(t.ts), index('access_log_ip_idx').on(t.ip), index('access_log_threat_idx').on(t.threat)],
);

// ── brute_force_log ───────────────────────────────────────────────────────────

export const bruteForceLockouts = pgTable('brute_force_lockouts', {
  key: text('key').primaryKey(), // "email:<addr>" or "ip:<addr>"
  count: integer('count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastFailAt: timestamp('last_fail_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── subscribers ───────────────────────────────────────────────────────────────

export const subscribers = pgTable(
  'subscribers',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    status: text('status').notNull().default('active'),
    source: text('source'),
    tags: jsonb('tags'),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('subscribers_email_idx').on(t.email)],
);

// ── operations_items ────────────────────────────────────────────────────────
// Central administration queue. Source-specific sensitive records remain in
// their purpose-built stores; this table contains only the operational subset
// needed for assignment, decisions, notes, and audit history.
export const operationsItems = pgTable(
  'operations_items',
  {
    id: text('id').primaryKey(),
    source: text('source').notNull(),
    referenceId: text('reference_id').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    requesterName: text('requester_name'),
    requesterEmail: text('requester_email'),
    userId: text('user_id'),
    status: text('status').notNull().default('new'),
    priority: text('priority').notNull().default('normal'),
    assignedTo: text('assigned_to'),
    adminNotes: jsonb('admin_notes').$type<Array<{ id: string; text: string; author: string; at: string }>>().notNull().default([]),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean>>().notNull().default({}),
    history: jsonb('history').$type<Array<{ at: string; actor: string; action: string; detail?: string }>>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('operations_items_source_reference_idx').on(t.source, t.referenceId), index('operations_items_status_updated_idx').on(t.status, t.updatedAt), index('operations_items_priority_idx').on(t.priority), index('operations_items_requester_email_idx').on(t.requesterEmail), index('operations_items_user_id_idx').on(t.userId)],
);

// ── social_profiles / social_share_events ──────────────────────────────────
// Profile URLs are public configuration. Share events contain message drafts
// and intent-launch history only; provider OAuth tokens are never stored here.
export const socialProfiles = pgTable('social_profiles', {
  platformId: text('platform_id').primaryKey(),
  url: text('url').notNull().default(''),
  enabled: boolean('enabled').notNull().default(false),
  showInFooter: boolean('show_in_footer').notNull().default(true),
  showInContact: boolean('show_in_contact').notNull().default(true),
  showInDashboard: boolean('show_in_dashboard').notNull().default(false),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const socialShareEvents = pgTable(
  'social_share_events',
  {
    id: text('id').primaryKey(),
    message: text('message').notNull(),
    targetUrl: text('target_url').notNull(),
    platforms: jsonb('platforms').$type<string[]>().notNull().default([]),
    openedPlatforms: jsonb('opened_platforms').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('ready'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('social_share_events_created_idx').on(t.createdAt), index('social_share_events_status_idx').on(t.status)],
);

// Sponsor-readiness stores controlled evidence metadata only. Original files,
// identity documents, credentials, and provider secrets are intentionally out
// of scope. Events are append-only and form the immutable review history.
export const sponsorPackages = pgTable('sponsor_packages', {
  id: text('id').primaryKey(),
  version: text('version').notNull(),
  jurisdiction: text('jurisdiction').notNull(),
  legalEntityState: text('legal_entity_state').notNull().default('unverified'),
  status: sponsorPackageStatusEnum('status').notNull().default('draft'),
  submittedBy: text('submitted_by'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNote: text('review_note'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sponsorEvidence = pgTable(
  'sponsor_evidence',
  {
    id: text('id').primaryKey(),
    packageId: text('package_id').notNull(),
    controlKey: text('control_key').notNull(),
    title: text('title').notNull(),
    status: sponsorEvidenceStatusEnum('status').notNull().default('draft'),
    referenceType: text('reference_type').$type<'url' | 'internal'>().notNull(),
    reference: text('reference').notNull(),
    sha256: text('sha256'),
    owner: text('owner').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    notes: text('notes'),
    evidenceClass: text('evidence_class').$type<'internal_design' | 'external_authority' | 'operating_evidence'>().notNull().default('internal_design'),
    externalIssuer: text('external_issuer'),
    authorityType: text('authority_type'),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    revision: integer('revision').notNull().default(1),
    submittedRevision: integer('submitted_revision'),
    reviewedRevision: integer('reviewed_revision'),
    createdBy: text('created_by').notNull(),
    lastEditedBy: text('last_edited_by').notNull(),
    submittedBy: text('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sponsor_evidence_package_control_idx').on(t.packageId, t.controlKey), index('sponsor_evidence_status_idx').on(t.status), index('sponsor_evidence_expiry_idx').on(t.expiresAt)],
);

// Each edit creates a complete metadata-only snapshot. Database triggers make
// these rows append-only, so a reviewer decision can always be tied to the
// exact revision that was submitted without retaining source documents.
export const sponsorEvidenceRevisions = pgTable(
  'sponsor_evidence_revisions',
  {
    id: text('id').primaryKey(),
    packageId: text('package_id').notNull(),
    evidenceId: text('evidence_id').notNull(),
    revision: integer('revision').notNull(),
    controlKey: text('control_key').notNull(),
    title: text('title').notNull(),
    referenceType: text('reference_type').$type<'url' | 'internal'>().notNull(),
    reference: text('reference').notNull(),
    sha256: text('sha256'),
    owner: text('owner').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    notes: text('notes'),
    evidenceClass: text('evidence_class').$type<'internal_design' | 'external_authority' | 'operating_evidence'>().notNull().default('internal_design'),
    externalIssuer: text('external_issuer'),
    authorityType: text('authority_type'),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    actorId: text('actor_id').notNull(),
    actorRole: adminRoleEnum('actor_role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sponsor_evidence_revisions_evidence_revision_idx').on(t.evidenceId, t.revision), index('sponsor_evidence_revisions_package_idx').on(t.packageId, t.createdAt)],
);

export const sponsorEvidenceEvents = pgTable(
  'sponsor_evidence_events',
  {
    id: text('id').primaryKey(),
    packageId: text('package_id').notNull(),
    evidenceId: text('evidence_id'),
    action: text('action').notNull(),
    actorId: text('actor_id').notNull(),
    actorRole: adminRoleEnum('actor_role').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sponsor_evidence_events_evidence_idx').on(t.evidenceId, t.createdAt), index('sponsor_evidence_events_package_idx').on(t.packageId, t.createdAt)],
);

export const onboardingCases = pgTable(
  'onboarding_cases',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    caseType: text('case_type').$type<'individual' | 'business'>().notNull(),
    status: text('status').$type<'draft' | 'submitted' | 'under_review' | 'needs_info' | 'approved' | 'rejected' | 'expired'>().notNull().default('draft'),
    version: integer('version').notNull().default(1),
    assignedTo: text('assigned_to'),
    submittedBy: text('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    lastEditedBy: text('last_edited_by').notNull(),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewReason: text('review_reason'),
    requestedEvidenceKinds: jsonb('requested_evidence_kinds').$type<Array<'identity_front' | 'identity_back' | 'proof_of_address' | 'additional'>>().notNull().default([]),
    customerInstructions: text('customer_instructions'),
    submissionIdempotencyKey: text('submission_idempotency_key'),
    screeningStatus: text('screening_status').$type<'not_run' | 'clear' | 'review' | 'match' | 'overdue'>().notNull().default('not_run'),
    lastScreenedAt: timestamp('last_screened_at', { withTimezone: true }),
    nextScreeningAt: timestamp('next_screening_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('onboarding_cases_status_updated_idx').on(t.status, t.updatedAt), index('onboarding_cases_user_idx').on(t.userId)],
);

export const kycProfiles = pgTable(
  'kyc_profiles',
  {
    userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    caseId: text('case_id').notNull().unique().references(() => onboardingCases.id, { onDelete: 'cascade' }),
    legalName: text('legal_name').notNull(),
    dateOfBirth: date('date_of_birth').notNull(),
    nationality: text('nationality').notNull(),
    residenceCountry: text('residence_country').notNull(),
    addressLine1: text('address_line1').notNull(),
    addressLine2: text('address_line2'),
    city: text('city').notNull(),
    region: text('region'),
    postalCode: text('postal_code').notNull(),
    documentType: text('document_type').$type<'passport' | 'national_id' | 'drivers_license' | 'residence_permit'>().notNull(),
    issuingCountry: text('issuing_country').notNull(),
    documentNumberCiphertext: text('document_number_ciphertext').notNull(),
    documentNumberLast4: text('document_number_last4').notNull(),
    documentIssuedAt: date('document_issued_at'),
    documentExpiresAt: date('document_expires_at').notNull(),
    informationCertified: boolean('information_certified').notNull().default(false),
    privacyAcknowledged: boolean('privacy_acknowledged').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('kyc_profiles_case_id_idx').on(t.caseId)],
);

export const kycDocuments = pgTable(
  'kyc_documents',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id').notNull().references(() => onboardingCases.id, { onDelete: 'restrict' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    kind: text('kind').$type<'identity_front' | 'identity_back' | 'proof_of_address' | 'additional'>().notNull(),
    storageKey: text('storage_key').notNull().unique(),
    mimeType: text('mime_type').$type<'image/jpeg' | 'image/png' | 'application/pdf'>().notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    state: text('state').$type<'active' | 'superseded' | 'rejected'>().notNull().default('active'),
    retentionClassification: text('retention_classification').notNull().default('regulated_identity_evidence_pending_policy'),
    version: integer('version').notNull(),
    originalName: text('original_name').notNull(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    supersededBy: text('superseded_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('kyc_documents_case_created_idx').on(t.caseId, t.createdAt),
    index('kyc_documents_user_created_idx').on(t.userId, t.createdAt),
  ],
);

export const onboardingEvidence = pgTable(
  'onboarding_evidence',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id').notNull(),
    kind: text('kind').$type<'identity' | 'address' | 'selfie' | 'company' | 'ownership' | 'authority' | 'screening'>().notNull(),
    referenceType: text('reference_type').$type<'provider' | 'controlled_url' | 'internal'>().notNull(),
    reference: text('reference').notNull(),
    sha256: text('sha256'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: text('created_by').notNull(),
    lastEditedBy: text('last_edited_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('onboarding_evidence_case_idx').on(t.caseId, t.createdAt)],
);

export const onboardingEvents = pgTable(
  'onboarding_events',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id').notNull(),
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    actorId: text('actor_id').notNull(),
    actorType: text('actor_type').$type<'customer' | 'admin' | 'system'>().notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('onboarding_events_case_created_idx').on(t.caseId, t.createdAt), index('onboarding_events_user_created_idx').on(t.userId, t.createdAt)],
);

export const complianceCases = pgTable(
  'compliance_cases',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind').$type<'aml' | 'sanctions'>().notNull(),
    status: text('status').$type<'open' | 'investigating' | 'escalated' | 'cleared' | 'blocked'>().notNull().default('open'),
    riskLevel: text('risk_level').$type<'unrated' | 'low' | 'medium' | 'high'>().notNull().default('unrated'),
    summary: text('summary').notNull(),
    assignedTo: text('assigned_to'),
    openedBy: text('opened_by').notNull(),
    lastEditedBy: text('last_edited_by').notNull(),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    resolution: text('resolution'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('compliance_cases_status_updated_idx').on(t.status, t.updatedAt), index('compliance_cases_user_idx').on(t.userId, t.createdAt)],
);

export const complianceCaseEvents = pgTable(
  'compliance_case_events',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id').notNull(),
    action: text('action').notNull(),
    actorId: text('actor_id').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('compliance_case_events_case_idx').on(t.caseId, t.createdAt)],
);

export const syntheticMonitoringAlerts = pgTable(
  'synthetic_monitoring_alerts',
  {
    id: text('id').primaryKey(), reference: text('reference').notNull(), fingerprint: text('fingerprint').notNull(),
    ruleKey: text('rule_key').$type<'velocity_count'|'velocity_amount'|'rapid_movement'|'unusual_asset'|'manual_review'>().notNull(),
    status: text('status').$type<'new'|'reviewing'|'escalated'|'resolution_pending'|'closed_false_positive'|'closed_case'>().notNull().default('new'),
    riskLevel: text('risk_level').$type<'low'|'medium'|'high'|'critical'>().notNull(), subjectReference: text('subject_reference').notNull(), summary: text('summary').notNull(),
    detectionWindowStart: timestamp('detection_window_start', { withTimezone: true }).notNull(), detectionWindowEnd: timestamp('detection_window_end', { withTimezone: true }).notNull(),
    transactionCount: integer('transaction_count').notNull(), aggregateAmountMinor: bigint('aggregate_amount_minor', { mode: 'bigint' }).notNull(), asset: text('asset').notNull(),
    caseId: text('case_id'), proposedResolution: text('proposed_resolution'), resolution: text('resolution'), generatedBy: text('generated_by').notNull(), lastEditedBy: text('last_edited_by').notNull(),
    submittedBy: text('submitted_by'), submittedAt: timestamp('submitted_at', { withTimezone: true }), resolvedBy: text('resolved_by'), resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    synthetic: boolean('synthetic').notNull().default(true), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('synthetic_monitoring_alerts_reference_idx').on(t.reference), uniqueIndex('synthetic_monitoring_alerts_fingerprint_idx').on(t.fingerprint), index('synthetic_monitoring_alerts_queue_idx').on(t.status, t.riskLevel, t.createdAt), index('synthetic_monitoring_alerts_subject_idx').on(t.subjectReference, t.createdAt)],
);

export const syntheticMonitoringAlertTransactions = pgTable(
  'synthetic_monitoring_alert_transactions',
  {
    id: text('id').primaryKey(), alertId: text('alert_id').notNull().references(() => syntheticMonitoringAlerts.id, { onDelete: 'restrict' }), transactionId: text('transaction_id').notNull(), transactionReference: text('transaction_reference').notNull(),
    transactionSource: text('transaction_source').$type<'financial_sandbox'|'money_movement_simulation'|'customer_simulation'>().notNull(), amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(), asset: text('asset').notNull(), occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    snapshotSha256: text('snapshot_sha256').notNull(), synthetic: boolean('synthetic').notNull().default(true), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('synthetic_monitoring_links_unique_idx').on(t.alertId, t.transactionSource, t.transactionId), index('synthetic_monitoring_links_alert_idx').on(t.alertId, t.occurredAt)],
);

export const syntheticMonitoringAlertEvents = pgTable(
  'synthetic_monitoring_alert_events',
  {
    id: text('id').primaryKey(), alertId: text('alert_id').notNull().references(() => syntheticMonitoringAlerts.id, { onDelete: 'restrict' }), action: text('action').notNull(), actorId: text('actor_id').notNull(), actorType: text('actor_type').$type<'system'|'admin'|'independent_checker'>().notNull(),
    fromStatus: text('from_status'), toStatus: text('to_status').notNull(), rationale: text('rationale').notNull(), correlationId: text('correlation_id').notNull(), details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    synthetic: boolean('synthetic').notNull().default(true), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('synthetic_monitoring_events_alert_idx').on(t.alertId, t.createdAt)],
);

// Synthetic provider rehearsal records are isolated from customer accounts and
// transaction tables. The database also enforces their syn_ reference boundary.
export const providerSandboxRuns = pgTable(
  'provider_sandbox_runs',
  {
    id: text('id').primaryKey(),
    idempotencyKey: text('idempotency_key').notNull(),
    subjectType: text('subject_type').$type<'individual' | 'business'>().notNull(),
    subjectRef: text('subject_ref').notNull(),
    status: text('status').$type<'running' | 'passed' | 'failed'>().notNull().default('running'),
    currencies: jsonb('currencies').$type<string[]>().notNull().default([]),
    results: jsonb('results').$type<Record<string, unknown>>().notNull().default({}),
    failureCode: text('failure_code'),
    initiatedBy: text('initiated_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('provider_sandbox_runs_idempotency_idx').on(t.idempotencyKey), index('provider_sandbox_runs_created_idx').on(t.createdAt)],
);

export const providerSandboxEvents = pgTable(
  'provider_sandbox_events',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    sequence: integer('sequence').notNull(),
    eventType: text('event_type').notNull(),
    providerRef: text('provider_ref'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('provider_sandbox_events_run_sequence_idx').on(t.runId, t.sequence), index('provider_sandbox_events_run_idx').on(t.runId)],
);

// Administration-managed links between existing customer profiles. These
// records express relationship metadata only and never confer account access,
// ownership, signing authority or permission to move funds by themselves.
export const customerRelationships = pgTable(
  'customer_relationships',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    relatedCustomerId: text('related_customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    relationshipType: text('relationship_type').$type<'joint_holder' | 'beneficial_owner' | 'director' | 'authorised_user' | 'beneficiary' | 'guarantor' | 'household' | 'business_contact'>().notNull(),
    status: text('status').$type<'pending' | 'active' | 'inactive'>().notNull().default('pending'),
    label: text('label').notNull().default(''),
    notes: text('notes').notNull().default(''),
    createdBy: text('created_by').notNull(),
    lastEditedBy: text('last_edited_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_relationships_unique_idx').on(t.customerId, t.relatedCustomerId, t.relationshipType), index('customer_relationships_customer_idx').on(t.customerId, t.updatedAt), index('customer_relationships_related_idx').on(t.relatedCustomerId, t.updatedAt)],
);

// Configured currencies are authoritative for the customer account registry.
// The browser reads these through authenticated APIs instead of hardcoding
// account availability throughout the interface.
export const platformCurrencies = pgTable('platform_currencies', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  flag: text('flag').notNull().default(''),
  decimals: integer('decimals').notNull().default(2),
  active: boolean('active').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Application account records only. They remain synthetic and their balances
// cannot be edited through the account-control endpoints. Financial simulation
// continues to live in the isolated double-entry sandbox ledger.
export const customerAccounts = pgTable(
  'customer_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    accountType: text('account_type').$type<'personal' | 'savings' | 'business'>().notNull(),
    status: text('status').$type<'pending' | 'active' | 'restricted' | 'closed'>().notNull().default('pending'),
    primaryCurrency: text('primary_currency')
      .notNull()
      .references(() => platformCurrencies.code, { onDelete: 'restrict' }),
    availableMinor: bigint('available_minor', { mode: 'bigint' }).notNull().default(0n),
    ledgerMinor: bigint('ledger_minor', { mode: 'bigint' }).notNull().default(0n),
    pendingMinor: bigint('pending_minor', { mode: 'bigint' }).notNull().default(0n),
    restrictions: jsonb('restrictions').$type<string[]>().notNull().default([]),
    synthetic: boolean('synthetic').notNull().default(true),
    creationIdempotencyKey: text('creation_idempotency_key').notNull(),
    creationFingerprint: text('creation_fingerprint').notNull(),
    createdBy: text('created_by').notNull(),
    lastEditedBy: text('last_edited_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_accounts_unique_idx').on(t.userId, t.accountType, t.primaryCurrency), uniqueIndex('customer_accounts_creation_key_idx').on(t.creationIdempotencyKey), index('customer_accounts_user_idx').on(t.userId, t.updatedAt), index('customer_accounts_status_idx').on(t.status, t.updatedAt)],
);

// Customer-facing balances are backed by this synthetic double-entry ledger.
// The model is application-only and is structurally unable to represent live
// provider settlement, custody or bank account identifiers.
export const customerLedgerAccounts = pgTable(
  'customer_ledger_accounts',
  {
    id: text('id').primaryKey(),
    customerAccountId: text('customer_account_id').references(() => customerAccounts.id, { onDelete: 'restrict' }),
    ownerUserId: text('owner_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    accountClass: text('account_class').$type<'customer' | 'simulation_treasury'>().notNull(),
    currency: text('currency')
      .notNull()
      .references(() => platformCurrencies.code, { onDelete: 'restrict' }),
    balanceMinor: bigint('balance_minor', { mode: 'bigint' }).notNull().default(0n),
    synthetic: boolean('synthetic').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_ledger_customer_account_idx').on(t.customerAccountId), index('customer_ledger_owner_idx').on(t.ownerUserId, t.updatedAt)],
);

export const customerSimulationTransactions = pgTable(
  'customer_simulation_transactions',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reference: text('reference').notNull(),
    kind: text('kind').$type<'opening_adjustment' | 'internal_transfer' | 'controlled_adjustment' | 'reversal'>().notNull(),
    status: text('status').$type<'pending' | 'processing' | 'completed' | 'failed' | 'reversed' | 'cancelled'>().notNull(),
    currency: text('currency')
      .notNull()
      .references(() => platformCurrencies.code, { onDelete: 'restrict' }),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    sourceLedgerAccountId: text('source_ledger_account_id').references(() => customerLedgerAccounts.id, { onDelete: 'restrict' }),
    destinationLedgerAccountId: text('destination_ledger_account_id').references(() => customerLedgerAccounts.id, { onDelete: 'restrict' }),
    description: text('description').notNull(),
    executionSource: text('execution_source').notNull().default('SIMULATION'),
    synthetic: boolean('synthetic').notNull().default(true),
    reversesId: text('reverses_id'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_simulation_transactions_reference_idx').on(t.reference), index('customer_simulation_transactions_owner_idx').on(t.ownerUserId, t.createdAt), index('customer_simulation_transactions_status_idx').on(t.status, t.createdAt)],
);

export const customerSimulationJournalEntries = pgTable(
  'customer_simulation_journal_entries',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => customerSimulationTransactions.id, {
        onDelete: 'restrict',
      }),
    reference: text('reference').notNull(),
    currency: text('currency')
      .notNull()
      .references(() => platformCurrencies.code, { onDelete: 'restrict' }),
    synthetic: boolean('synthetic').notNull().default(true),
    postedBy: text('posted_by').notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_simulation_journal_transaction_idx').on(t.transactionId), uniqueIndex('customer_simulation_journal_reference_idx').on(t.reference)],
);

export const customerSimulationJournalLines = pgTable(
  'customer_simulation_journal_lines',
  {
    id: text('id').primaryKey(),
    journalEntryId: text('journal_entry_id')
      .notNull()
      .references(() => customerSimulationJournalEntries.id, {
        onDelete: 'restrict',
      }),
    ledgerAccountId: text('ledger_account_id')
      .notNull()
      .references(() => customerLedgerAccounts.id, { onDelete: 'restrict' }),
    currency: text('currency')
      .notNull()
      .references(() => platformCurrencies.code, { onDelete: 'restrict' }),
    debitMinor: bigint('debit_minor', { mode: 'bigint' }).notNull().default(0n),
    creditMinor: bigint('credit_minor', { mode: 'bigint' }).notNull().default(0n),
    synthetic: boolean('synthetic').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('customer_simulation_journal_lines_entry_idx').on(t.journalEntryId)],
);

export const customerSimulationCommands = pgTable(
  'customer_simulation_commands',
  {
    actorScope: text('actor_scope').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    action: text('action').notNull(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => customerSimulationTransactions.id, {
        onDelete: 'restrict',
      }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_simulation_commands_scope_key_idx').on(t.actorScope, t.idempotencyKey)],
);

export const onboardingProviderEvents = pgTable(
  'onboarding_provider_events',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    providerCode: text('provider_code').notNull(),
    caseId: text('case_id').notNull(),
    providerRef: text('provider_ref').notNull(),
    kind: text('kind').$type<'identity' | 'kyb' | 'screening'>().notNull(),
    status: text('status').$type<'accepted' | 'review' | 'rejected'>().notNull(),
    purpose: text('purpose').$type<'onboarding' | 'rescreen'>().notNull().default('onboarding'),
    screenedAt: timestamp('screened_at', { withTimezone: true }),
    screening: jsonb('screening').$type<{
      sanctions: string;
      pep: string;
      adverseMedia: string;
    } | null>(),
    payloadSha256: text('payload_sha256').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('onboarding_provider_events_event_idx').on(t.eventId), index('onboarding_provider_events_case_idx').on(t.caseId, t.receivedAt), index('onboarding_provider_events_provider_ref_idx').on(t.providerCode, t.providerRef)],
);

export const complaints = pgTable(
  'complaints',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    userName: text('user_name').notNull(),
    userEmail: text('user_email').notNull(),
    userPhone: text('user_phone').notNull().default(''),
    category: text('category').$type<'transaction' | 'account' | 'card' | 'kyc' | 'staff' | 'technical' | 'other'>().notNull(),
    severity: text('severity').$type<'low' | 'medium' | 'high' | 'critical'>().notNull(),
    subject: text('subject').notNull(),
    description: text('description').notNull(),
    evidence: jsonb('evidence').$type<string[]>().notNull().default([]),
    status: text('status').$type<'open' | 'investigating' | 'escalated' | 'resolved' | 'closed'>().notNull().default('open'),
    assignedTo: text('assigned_to'),
    resolution: text('resolution'),
    internalNotes: text('internal_notes').notNull().default(''),
    regulatoryFlag: boolean('regulatory_flag').notNull().default(false),
    responseDueAt: timestamp('response_due_at', {
      withTimezone: true,
    }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    createdBy: text('created_by').notNull(),
    lastEditedBy: text('last_edited_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('complaints_status_due_idx').on(t.status, t.responseDueAt), index('complaints_severity_created_idx').on(t.severity, t.createdAt)],
);

export const complaintEvents = pgTable(
  'complaint_events',
  {
    id: text('id').primaryKey(),
    complaintId: text('complaint_id').notNull(),
    action: text('action').notNull(),
    actorId: text('actor_id').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('complaint_events_complaint_idx').on(t.complaintId, t.createdAt)],
);

// Independent-assurance exercise metadata. Original reports and sensitive
// findings remain in a controlled evidence repository; this register stores
// only references, hashes, decisions and immutable lifecycle history.
export const assuranceExercises = pgTable(
  'assurance_exercises',
  {
    id: text('id').primaryKey(),
    kind: text('kind').$type<'penetration_test' | 'disaster_recovery' | 'compliance_acceptance'>().notNull(),
    title: text('title').notNull(),
    scope: text('scope').notNull(),
    owner: text('owner').notNull(),
    provider: text('provider'),
    status: text('status').$type<'planned' | 'in_progress' | 'submitted' | 'accepted' | 'rejected'>().notNull().default('planned'),
    outcome: text('outcome').$type<'not_run' | 'passed' | 'passed_with_findings' | 'failed'>().notNull().default('not_run'),
    evidenceUrl: text('evidence_url'),
    evidenceSha256: text('evidence_sha256'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    criticalFindings: integer('critical_findings').notNull().default(0),
    highFindings: integer('high_findings').notNull().default(0),
    openFindings: integer('open_findings').notNull().default(0),
    notes: text('notes'),
    createdBy: text('created_by').notNull(),
    lastEditedBy: text('last_edited_by').notNull(),
    submittedBy: text('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assurance_exercises_kind_status_idx').on(t.kind, t.status), index('assurance_exercises_expiry_idx').on(t.expiresAt)],
);

export const assuranceExerciseEvents = pgTable(
  'assurance_exercise_events',
  {
    id: text('id').primaryKey(),
    exerciseId: text('exercise_id').notNull(),
    action: text('action').notNull(),
    actorId: text('actor_id').notNull(),
    actorRole: adminRoleEnum('actor_role').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assurance_exercise_events_exercise_idx').on(t.exerciseId, t.createdAt)],
);

// Public-registry and opaque beneficial-owner verification metadata only.
// Identity documents, dates of birth, residential addresses and credentials
// remain with approved providers and are never stored in this register.
export const legalEntityProfiles = pgTable(
  'legal_entity_profiles',
  {
    id: text('id').primaryKey(),
    packageId: text('package_id').notNull(),
    version: integer('version').notNull().default(1),
    legalName: text('legal_name').notNull(),
    jurisdiction: text('jurisdiction').notNull(),
    registrationNumber: text('registration_number').notNull(),
    legalForm: text('legal_form').notNull(),
    registryUrl: text('registry_url').notNull(),
    registrySha256: text('registry_sha256'),
    authorityType: text('authority_type').$type<'board_resolution' | 'officer_certificate' | 'power_of_attorney' | 'other'>(),
    authorityReference: text('authority_reference'),
    authoritySha256: text('authority_sha256'),
    authorizedOfficerRef: text('authorized_officer_ref'),
    authorityIssuedAt: timestamp('authority_issued_at', { withTimezone: true }),
    authorityExpiresAt: timestamp('authority_expires_at', {
      withTimezone: true,
    }),
    status: text('status').$type<'draft' | 'submitted' | 'verified' | 'rejected' | 'expired'>().notNull().default('draft'),
    createdBy: text('created_by').notNull(),
    lastEditedBy: text('last_edited_by').notNull(),
    submittedBy: text('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('legal_entity_profiles_package_idx').on(t.packageId), index('legal_entity_profiles_status_idx').on(t.status)],
);

export const beneficialOwnerRecords = pgTable(
  'beneficial_owner_records',
  {
    id: text('id').primaryKey(),
    entityId: text('entity_id').notNull(),
    controllerRef: text('controller_ref').notNull(),
    ownershipBand: text('ownership_band').$type<'none' | '0-25' | '25-50' | '50-75' | '75-100'>().notNull(),
    controlNature: text('control_nature').notNull(),
    providerCode: text('provider_code').notNull(),
    providerRef: text('provider_ref').notNull(),
    evidenceSha256: text('evidence_sha256'),
    status: text('status').$type<'draft' | 'submitted' | 'verified' | 'rejected' | 'expired'>().notNull().default('draft'),
    active: boolean('active').notNull().default(true),
    createdBy: text('created_by').notNull(),
    lastEditedBy: text('last_edited_by').notNull(),
    submittedBy: text('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('beneficial_owner_entity_ref_idx').on(t.entityId, t.controllerRef), index('beneficial_owner_status_idx').on(t.status, t.active)],
);

export const legalEntityVerificationEvents = pgTable(
  'legal_entity_verification_events',
  {
    id: text('id').primaryKey(),
    entityId: text('entity_id').notNull(),
    ownerRecordId: text('owner_record_id'),
    action: text('action').notNull(),
    actorId: text('actor_id').notNull(),
    actorRole: adminRoleEnum('actor_role').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('legal_entity_events_entity_idx').on(t.entityId, t.createdAt), index('legal_entity_events_owner_idx').on(t.ownerRecordId, t.createdAt)],
);

// Plaid sandbox connection metadata. Access tokens are AES-256-GCM encrypted;
// balances returned by Plaid are informational and never feed the CGC ledger.
export const plaidItems = pgTable(
  'plaid_items',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    itemId: text('item_id').notNull(),
    accessTokenEnc: text('access_token_enc').notNull(),
    institutionId: text('institution_id'),
    institutionName: text('institution_name'),
    accounts: jsonb('accounts')
      .$type<
        Array<{
          id: string;
          name: string;
          mask: string | null;
          type: string;
          subtype: string | null;
        }>
      >()
      .notNull()
      .default([]),
    status: text('status').$type<'active' | 'disconnected' | 'error'>().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('plaid_items_item_idx').on(t.itemId), index('plaid_items_user_idx').on(t.userId, t.status)],
);

export const dataQuarantineBatches = pgTable('data_quarantine_batches', {
  id: text('id').primaryKey(),
  providerBackupReference: text('provider_backup_reference').notNull(),
  providerBackupVerifiedAt: timestamp('provider_backup_verified_at', {
    withTimezone: true,
  }).notNull(),
  reason: text('reason').notNull(),
  initiatedBy: text('initiated_by').notNull(),
  status: text('status').$type<'planned' | 'applied' | 'restored'>().notNull().default('planned'),
  customerCount: integer('customer_count').notNull().default(0),
  transactionCount: integer('transaction_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  restoredAt: timestamp('restored_at', { withTimezone: true }),
  restoreApprovalReference: text('restore_approval_reference'),
});

/**
 * Financial simulation tables are deliberately separate from customer money
 * tables. Every identifier is synthetic and no foreign key reaches users,
 * customer accounts, provider accounts, cards, wallets, or live transactions.
 */
export const financialSandboxAccounts = pgTable(
  'financial_sandbox_accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    accountType: text('account_type').$type<'personal' | 'savings' | 'business' | 'fiat_wallet' | 'crypto_wallet' | 'treasury'>().notNull(),
    asset: text('asset').notNull(),
    balanceMinor: bigint('balance_minor', { mode: 'bigint' }).notNull().default(0n),
    synthetic: boolean('synthetic').notNull().default(true),
    creationIdempotencyKey: text('creation_idempotency_key').notNull(),
    creationFingerprint: text('creation_fingerprint').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('financial_sandbox_accounts_creation_key_idx').on(t.creationIdempotencyKey), index('financial_sandbox_accounts_asset_idx').on(t.asset, t.updatedAt)],
);

export const financialSandboxTransactions = pgTable(
  'financial_sandbox_transactions',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    idempotencyFingerprint: text('idempotency_fingerprint').notNull(),
    kind: text('kind').$type<'mock' | 'internal_transfer' | 'crypto_transfer' | 'adjustment' | 'reversal'>().notNull(),
    status: text('status').$type<'pending' | 'processing' | 'completed' | 'failed' | 'reversed' | 'cancelled'>().notNull(),
    asset: text('asset').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    sourceAccountId: text('source_account_id').references(() => financialSandboxAccounts.id, { onDelete: 'restrict' }),
    destinationAccountId: text('destination_account_id').references(() => financialSandboxAccounts.id, { onDelete: 'restrict' }),
    reason: text('reason').notNull(),
    executionSource: text('execution_source').notNull().default('SIMULATION'),
    synthetic: boolean('synthetic').notNull().default(true),
    reversesId: text('reverses_id'),
    cancellationReason: text('cancellation_reason'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('financial_sandbox_transactions_reference_idx').on(t.reference), uniqueIndex('financial_sandbox_transactions_idempotency_idx').on(t.idempotencyKey), index('financial_sandbox_transactions_status_idx').on(t.status, t.createdAt)],
);

export const financialSandboxJournalEntries = pgTable(
  'financial_sandbox_journal_entries',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => financialSandboxTransactions.id, {
        onDelete: 'restrict',
      }),
    reference: text('reference').notNull(),
    asset: text('asset').notNull(),
    synthetic: boolean('synthetic').notNull().default(true),
    postedBy: text('posted_by').notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('financial_sandbox_journal_transaction_idx').on(t.transactionId), uniqueIndex('financial_sandbox_journal_reference_idx').on(t.reference)],
);

export const financialSandboxJournalLines = pgTable(
  'financial_sandbox_journal_lines',
  {
    id: text('id').primaryKey(),
    journalEntryId: text('journal_entry_id')
      .notNull()
      .references(() => financialSandboxJournalEntries.id, {
        onDelete: 'restrict',
      }),
    accountId: text('account_id')
      .notNull()
      .references(() => financialSandboxAccounts.id, { onDelete: 'restrict' }),
    asset: text('asset').notNull(),
    debitMinor: bigint('debit_minor', { mode: 'bigint' }).notNull().default(0n),
    creditMinor: bigint('credit_minor', { mode: 'bigint' }).notNull().default(0n),
    synthetic: boolean('synthetic').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('financial_sandbox_journal_lines_entry_idx').on(t.journalEntryId)],
);

export const financialSandboxCommands = pgTable('financial_sandbox_commands', {
  idempotencyKey: text('idempotency_key').primaryKey(),
  fingerprint: text('fingerprint').notNull(),
  action: text('action').notNull(),
  resultType: text('result_type').notNull(),
  resultId: text('result_id').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const moneyMovementSimulationInstructions = pgTable(
  'money_movement_simulation_instructions',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull(),
    rail: text('rail').$type<'p2p' | 'ach' | 'wire' | 'rtp' | 'fednow' | 'mobile_check_deposit' | 'direct_deposit' | 'withdrawal' | 'scheduled_payment' | 'recurring_payment' | 'card' | 'bill_pay'>().notNull(),
    direction: text('direction').$type<'inbound' | 'outbound' | 'internal'>().notNull(),
    status: text('status').$type<'pending_approval' | 'scheduled' | 'queued' | 'processing' | 'settled' | 'returned' | 'failed' | 'cancelled'>().notNull(),
    asset: text('asset').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    sourceReference: text('source_reference').notNull(),
    destinationReference: text('destination_reference').notNull(),
    memo: text('memo').notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    recurrence: text('recurrence').$type<'daily' | 'weekly' | 'monthly'>(),
    providerAdapterState: text('provider_adapter_state').notNull().default('DISCONNECTED'),
    executionSource: text('execution_source').notNull().default('SIMULATION'),
    synthetic: boolean('synthetic').notNull().default(true),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('money_movement_simulation_reference_idx').on(t.reference), index('money_movement_simulation_status_idx').on(t.status, t.createdAt), index('money_movement_simulation_rail_idx').on(t.rail, t.createdAt)],
);

export const moneyMovementSimulationEvents = pgTable(
  'money_movement_simulation_events',
  {
    id: text('id').primaryKey(),
    instructionId: text('instruction_id')
      .notNull()
      .references(() => moneyMovementSimulationInstructions.id, {
        onDelete: 'restrict',
      }),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    reason: text('reason').notNull(),
    requestCorrelationId: text('request_correlation_id').notNull(),
    actorId: text('actor_id').notNull(),
    synthetic: boolean('synthetic').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('money_movement_simulation_events_instruction_idx').on(t.instructionId, t.createdAt)],
);

export const moneyMovementSimulationCommands = pgTable(
  'money_movement_simulation_commands',
  {
    actorScope: text('actor_scope').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    action: text('action').notNull(),
    resultId: text('result_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('money_movement_simulation_command_idx').on(t.actorScope, t.idempotencyKey)],
);

export const syntheticReconciliationRuns = pgTable('synthetic_reconciliation_runs', {
  id: text('id').primaryKey(), reference: text('reference').notNull().unique(), businessDate: date('business_date').notNull(),
  status: text('status').$type<'completed'|'completed_with_breaks'>().notNull(), transactionCount: integer('transaction_count').notNull(),
  providerInstructionCount: integer('provider_instruction_count').notNull(), journalEntryCount: integer('journal_entry_count').notNull(),
  matchedCount: integer('matched_count').notNull(), exceptionCount: integer('exception_count').notNull(), matchedAmountMinor: bigint('matched_amount_minor',{mode:'bigint'}).notNull().default(0n),
  snapshotSha256: text('snapshot_sha256').notNull(), generatedBy: text('generated_by').notNull(), synthetic: boolean('synthetic').notNull().default(true), createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
}, t => [index('synthetic_reconciliation_runs_date_idx').on(t.businessDate,t.createdAt)]);
export const syntheticReconciliationItems = pgTable('synthetic_reconciliation_items', {
  id:text('id').primaryKey(), runId:text('run_id').notNull().references(()=>syntheticReconciliationRuns.id,{onDelete:'restrict'}), outcome:text('outcome').notNull(), severity:text('severity').notNull(),
  providerInstructionId:text('provider_instruction_id'), transactionId:text('transaction_id'), transactionReference:text('transaction_reference'), journalEntryReference:text('journal_entry_reference'), asset:text('asset'), amountMinor:bigint('amount_minor',{mode:'bigint'}), snapshotSha256:text('snapshot_sha256').notNull(), synthetic:boolean('synthetic').notNull().default(true), createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
}, t => [index('synthetic_reconciliation_items_run_idx').on(t.runId,t.outcome)]);
export const syntheticReconciliationExceptions = pgTable('synthetic_reconciliation_exceptions', {
  id:text('id').primaryKey(), itemId:text('item_id').notNull().unique().references(()=>syntheticReconciliationItems.id,{onDelete:'restrict'}), status:text('status').notNull().default('open'), owner:text('owner'), investigationNotes:text('investigation_notes'), proposedResolution:text('proposed_resolution'), submittedBy:text('submitted_by'), submittedAt:timestamp('submitted_at',{withTimezone:true}), resolvedBy:text('resolved_by'), resolvedAt:timestamp('resolved_at',{withTimezone:true}), lastEditedBy:text('last_edited_by').notNull(), updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
}, t => [index('synthetic_reconciliation_exceptions_status_idx').on(t.status,t.updatedAt)]);
export const syntheticReconciliationEvents = pgTable('synthetic_reconciliation_events', {
  id:text('id').primaryKey(), exceptionId:text('exception_id').notNull().references(()=>syntheticReconciliationExceptions.id,{onDelete:'restrict'}), action:text('action').notNull(), actorId:text('actor_id').notNull(), actorType:text('actor_type').notNull(), fromStatus:text('from_status'), toStatus:text('to_status').notNull(), rationale:text('rationale').notNull(), requestCorrelationId:text('request_correlation_id').notNull(), details:jsonb('details').$type<Record<string,unknown>>().notNull().default({}), createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
}, t => [index('synthetic_reconciliation_events_exception_idx').on(t.exceptionId,t.createdAt)]);
export const syntheticReconciliationExports = pgTable('synthetic_reconciliation_exports', {
  id:text('id').primaryKey(), runId:text('run_id').notNull().references(()=>syntheticReconciliationRuns.id,{onDelete:'restrict'}), evidenceSha256:text('evidence_sha256').notNull(), filename:text('filename').notNull(), generatedBy:text('generated_by').notNull(), createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});

export const dataQuarantineRecords = pgTable(
  'data_quarantine_records',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id')
      .notNull()
      .references(() => dataQuarantineBatches.id),
    resourceType: text('resource_type').$type<'user' | 'transaction'>().notNull(),
    resourceId: text('resource_id').notNull(),
    previousState: jsonb('previous_state').$type<Record<string, unknown>>().notNull(),
    snapshotSha256: text('snapshot_sha256').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('data_quarantine_records_batch_idx').on(t.batchId), uniqueIndex('data_quarantine_records_batch_resource_idx').on(t.batchId, t.resourceType, t.resourceId)],
);

export const operationsQuarantineBatches = pgTable('operations_quarantine_batches', {
  id: text('id').primaryKey(),
  backupFilename: text('backup_filename').notNull(),
  backupSha256: text('backup_sha256').notNull(),
  reason: text('reason').notNull(),
  initiatedBy: text('initiated_by').notNull(),
  status: text('status').$type<'planned' | 'applied' | 'restored'>().notNull().default('planned'),
  itemCount: integer('item_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  restoredAt: timestamp('restored_at', { withTimezone: true }),
  restoreApprovalReference: text('restore_approval_reference'),
});

export const operationsQuarantineRecords = pgTable(
  'operations_quarantine_records',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id')
      .notNull()
      .references(() => operationsQuarantineBatches.id),
    operationsItemId: text('operations_item_id')
      .notNull()
      .references(() => operationsItems.id),
    previousState: jsonb('previous_state').$type<Record<string, unknown>>().notNull(),
    snapshotSha256: text('snapshot_sha256').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('operations_quarantine_records_batch_idx').on(t.batchId), uniqueIndex('operations_quarantine_records_batch_item_idx').on(t.batchId, t.operationsItemId)],
);

// Planning records only. These values are not account balances and cannot
// create journal entries or move funds.
export const customerGoals = pgTable(
  'customer_goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    currency: text('currency').notNull().references(() => platformCurrencies.code, { onDelete: 'restrict' }),
    targetMinor: bigint('target_minor', { mode: 'bigint' }).notNull(),
    trackedMinor: bigint('tracked_minor', { mode: 'bigint' }).notNull().default(0n),
    monthlyContributionMinor: bigint('monthly_contribution_minor', { mode: 'bigint' }).notNull().default(0n),
    targetDate: date('target_date'),
    status: text('status').$type<'active' | 'completed' | 'paused'>().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('customer_goals_user_updated_idx').on(t.userId, t.updatedAt)],
);

export const customerBillSchedules = pgTable(
  'customer_bill_schedules',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    payee: text('payee').notNull(),
    category: text('category').notNull(),
    currency: text('currency').notNull().references(() => platformCurrencies.code, { onDelete: 'restrict' }),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    frequency: text('frequency').$type<'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'annually'>().notNull(),
    nextDueDate: date('next_due_date').notNull(),
    reminderDays: integer('reminder_days').notNull().default(3),
    status: text('status').$type<'scheduled' | 'paused' | 'completed'>().notNull().default('scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('customer_bill_schedules_user_due_idx').on(t.userId, t.nextDueDate, t.updatedAt)],
);

export const customerRewardAccounts = pgTable('customer_reward_accounts', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  pointsBalance: bigint('points_balance', { mode: 'bigint' }).notNull().default(0n),
  cashbackMinor: bigint('cashback_minor', { mode: 'bigint' }).notNull().default(0n),
  cashbackCurrency: text('cashback_currency').notNull().default('GBP').references(() => platformCurrencies.code, { onDelete: 'restrict' }),
  membershipTier: text('membership_tier').notNull().default('Member'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customerRewardEvents = pgTable(
  'customer_reward_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').$type<'earned' | 'pending' | 'redeemed' | 'cashback'>().notNull(),
    points: bigint('points', { mode: 'bigint' }).notNull().default(0n),
    cashbackMinor: bigint('cashback_minor', { mode: 'bigint' }).notNull().default(0n),
    currency: text('currency').notNull().default('GBP').references(() => platformCurrencies.code, { onDelete: 'restrict' }),
    description: text('description').notNull(),
    providerReference: text('provider_reference'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('customer_reward_events_user_date_idx').on(t.userId, t.occurredAt)],
);

// ── Type exports (inferred from schema) ───────────────────────────────────────

// Public brand/media metadata. Binary objects live in managed object storage.
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    filename: text('filename').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    mediaType: text('media_type').$type<'image' | 'video' | 'pdf' | 'document'>().notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    publicUrl: text('public_url').notNull(),
    storageKey: text('storage_key'),
    altText: text('alt_text').notNull().default(''),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    folder: text('folder').notNull().default('uncategorized'),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: integer('duration_seconds'),
    optimized: boolean('optimized').notNull().default(false),
    optimizedSizeBytes: bigint('optimized_size_bytes', { mode: 'number' }),
    replacedById: text('replaced_by_id'),
    uploadedBy: text('uploaded_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_assets_created_idx').on(t.createdAt),
    index('media_assets_type_idx').on(t.mediaType),
    index('media_assets_folder_idx').on(t.folder),
  ],
);

export const mediaAssetAssignments = pgTable(
  'media_asset_assignments',
  {
    id: text('id').primaryKey(),
    mediaAssetId: text('media_asset_id').notNull().references(() => mediaAssets.id, { onDelete: 'restrict' }),
    pageKey: text('page_key').notNull(),
    slotKey: text('slot_key').notNull(),
    cropX: integer('crop_x').notNull().default(50),
    cropY: integer('crop_y').notNull().default(50),
    cropZoom: numeric('crop_zoom', { precision: 4, scale: 2 }).notNull().default('1'),
    cropAspect: text('crop_aspect').$type<'original' | 'square' | 'portrait' | 'landscape' | 'wide'>().notNull().default('original'),
    assignedBy: text('assigned_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('media_asset_assignments_page_slot_idx').on(t.pageKey, t.slotKey),
    index('media_asset_assignments_asset_idx').on(t.mediaAssetId),
  ],
);

export const homepageContentVersions = pgTable(
  'homepage_content_versions',
  {
    version: integer('version').primaryKey(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    contentHash: text('content_hash').notNull(),
    updatedBy: text('updated_by').notNull(),
    reason: text('reason').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('homepage_content_versions_hash_idx').on(t.contentHash), index('homepage_content_versions_updated_idx').on(t.updatedAt)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AdminSession = typeof adminSessions.$inferSelect;
export type CustomerSession = typeof customerSessions.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type CardActivity = typeof cardActivity.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type KycNote = typeof kycNotes.$inferSelect;
export type TradingPosition = typeof tradingPositions.$inferSelect;
export type TradingOrder = typeof tradingOrders.$inferSelect;
export type AccessLogEntry = typeof accessLog.$inferSelect;
export type TradingTrade = typeof tradingTrades.$inferSelect;
export type TradingWatchlistItem = typeof tradingWatchlist.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SupportConversation = typeof supportConversations.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type SupportNote = typeof supportNotes.$inferSelect;
export type CannedResponse = typeof cannedResponses.$inferSelect;
export type LoginEvent = typeof loginEvents.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type EmailQueueItem = typeof emailQueue.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type OperationsItemRow = typeof operationsItems.$inferSelect;
export type SocialProfileRow = typeof socialProfiles.$inferSelect;
export type SocialShareEventRow = typeof socialShareEvents.$inferSelect;
export type SponsorPackageRow = typeof sponsorPackages.$inferSelect;
export type SponsorEvidenceRow = typeof sponsorEvidence.$inferSelect;
export type SponsorEvidenceEventRow = typeof sponsorEvidenceEvents.$inferSelect;
export type SponsorEvidenceRevisionRow = typeof sponsorEvidenceRevisions.$inferSelect;
export type OnboardingCaseRow = typeof onboardingCases.$inferSelect;
export type OnboardingEvidenceRow = typeof onboardingEvidence.$inferSelect;
export type OnboardingEventRow = typeof onboardingEvents.$inferSelect;
export type ComplianceCaseRow = typeof complianceCases.$inferSelect;
export type ComplianceCaseEventRow = typeof complianceCaseEvents.$inferSelect;
export type ProviderSandboxRunRow = typeof providerSandboxRuns.$inferSelect;
export type ProviderSandboxEventRow = typeof providerSandboxEvents.$inferSelect;
export type OnboardingProviderEventRow = typeof onboardingProviderEvents.$inferSelect;
export type ComplaintRow = typeof complaints.$inferSelect;
export type ComplaintEventRow = typeof complaintEvents.$inferSelect;
export type AssuranceExerciseRow = typeof assuranceExercises.$inferSelect;
export type AssuranceExerciseEventRow = typeof assuranceExerciseEvents.$inferSelect;
export type LegalEntityProfileRow = typeof legalEntityProfiles.$inferSelect;
export type BeneficialOwnerRecordRow = typeof beneficialOwnerRecords.$inferSelect;
export type LegalEntityVerificationEventRow = typeof legalEntityVerificationEvents.$inferSelect;
export type PlaidItemRow = typeof plaidItems.$inferSelect;
export type DataQuarantineBatchRow = typeof dataQuarantineBatches.$inferSelect;
export type DataQuarantineRecordRow = typeof dataQuarantineRecords.$inferSelect;
export type CustomerGoalRow = typeof customerGoals.$inferSelect;
export type CustomerBillScheduleRow = typeof customerBillSchedules.$inferSelect;
export type CustomerRewardAccountRow = typeof customerRewardAccounts.$inferSelect;
export type CustomerRewardEventRow = typeof customerRewardEvents.$inferSelect;
export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type MediaAssetAssignmentRow = typeof mediaAssetAssignments.$inferSelect;
export type HomepageContentVersionRow = typeof homepageContentVersions.$inferSelect;
