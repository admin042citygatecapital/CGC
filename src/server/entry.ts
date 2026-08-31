import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
// Security & performance middleware
import { securityHeaders, enforceHttps, removeFingerprinting, requestSizeGuard, apiCacheHeaders } from "./lib/securityMiddleware";
import { pathHardeningMiddleware } from "./lib/pathHardeningMiddleware";
import { rateLimitMiddleware } from "./lib/rateLimiter";
import { httpLogger, redactHttpLogUrl } from "./lib/httpLogger";
import { safeApiErrorDetails } from "./lib/apiErrorLog";
import { isSystemHost } from "./seo-host";
import cookieParser from "cookie-parser";
import compression from "compression";
import { closeConnection } from "./db/db";
import { requireEnabledCustomerFeature } from "./lib/platformFeatureControls";
import { issueCustomerResetToken } from "./lib/customerResetTokenStore";
import platform_features_get from "./api/platform/features/GET";
import users_features_get from "./api/users/features/GET";
import admin_features_get from "./api/admin/features/GET";
import { createMediaAssetsMiddleware } from "../../export-plugins/media-assets-plugin";
import admin_kyc_document_get from "./api/admin/kyc/document/GET";
import admin_operations_get from "./api/admin/operations/GET";
import admin_operations_post from "./api/admin/operations/POST";
import admin_security_logs_get from "./api/admin/security/logs/GET";
import admin_trading_logs_get from "./api/admin/trading/logs/GET";
import admin_users_id_get from "./api/admin/users/[id]/GET";
import admin_documentation_format_get from "./api/admin/documentation/[format]/GET";
import admin_onboarding_get from "./api/admin/onboarding/GET";
import admin_onboarding_review_post from "./api/admin/onboarding/review/POST";
import admin_onboarding_compliance_cases_get from "./api/admin/onboarding/compliance-cases/GET";
import admin_onboarding_compliance_cases_post from "./api/admin/onboarding/compliance-cases/POST";
import admin_onboarding_monitoring_get from "./api/admin/onboarding/monitoring/GET";
import admin_onboarding_monitoring_post from "./api/admin/onboarding/monitoring/POST";
import users_onboarding_get from "./api/users/onboarding/GET";
import users_onboarding_evidence_post from "./api/users/onboarding/evidence/POST";
import users_onboarding_submit_post from "./api/users/onboarding/submit/POST";
import providers_onboarding_webhook_post from "./api/providers/onboarding/webhook/POST";
import resend_webhook_post from "./api/webhooks/resend/POST";
import admin_onboarding_screening_get from "./api/admin/onboarding/screening/GET";
import admin_legal_entity_get from "./api/admin/legal-entity/GET";
import admin_legal_entity_post from "./api/admin/legal-entity/POST";
import admin_legal_entity_owners_post from "./api/admin/legal-entity/owners/POST";

// <api-imports>
import accounts_apply_post_0 from "./api/accounts/apply/POST";
import admin_audit_get_1 from "./api/admin/audit/GET";
import admin_auth_diag_get_2 from "./api/admin/auth/diag/GET";
import admin_auth_login_post_3 from "./api/admin/auth/login/POST";
import admin_auth_logout_post_4 from "./api/admin/auth/logout/POST";
import admin_auth_otp_verify_post_5 from "./api/admin/auth/otp/verify/POST";
import admin_auth_otp_resend_post from "./api/admin/auth/otp/resend/POST";
import admin_auth_password_reset_post_6 from "./api/admin/auth/password-reset/POST";
import admin_auth_password_reset_confirm_post_7 from "./api/admin/auth/password-reset/confirm/POST";
import admin_auth_trusted_devices_delete_8 from "./api/admin/auth/trusted-devices/DELETE";
import admin_auth_trusted_devices_get_9 from "./api/admin/auth/trusted-devices/GET";
import admin_auth_unlock_post_10 from "./api/admin/auth/unlock/POST";
import admin_auth_verify_get_11 from "./api/admin/auth/verify/GET";
import admin_balance_adjust_post_12 from "./api/admin/balance/adjust/POST";
import admin_balance_history_get_13 from "./api/admin/balance/history/GET";
import admin_cards_get_14 from "./api/admin/cards/GET";
import admin_cards_freeze_post_15 from "./api/admin/cards/freeze/POST";
import admin_cards_issue_post_16 from "./api/admin/cards/issue/POST";
import admin_cards_pin_post_17 from "./api/admin/cards/pin/POST";
import admin_cards_replace_post_18 from "./api/admin/cards/replace/POST";
import admin_cards_spending_limit_post_19 from "./api/admin/cards/spending-limit/POST";
import admin_cards_id_activity_get_20 from "./api/admin/cards/[id]/activity/GET";
import admin_chatbot_get_21 from "./api/admin/chatbot/GET";
import admin_chatbot_post_22 from "./api/admin/chatbot/POST";
import admin_cms_get_23 from "./api/admin/cms/GET";
import admin_cms_post_24 from "./api/admin/cms/POST";
import admin_cms_homepage_get from "./api/admin/cms/homepage/GET";
import admin_cms_homepage_post from "./api/admin/cms/homepage/POST";
import admin_cms_blog_get_25 from "./api/admin/cms/blog/GET";
import admin_cms_blog_post_26 from "./api/admin/cms/blog/POST";
import admin_cms_features_get_27 from "./api/admin/cms/features/GET";
import admin_cms_features_post_28 from "./api/admin/cms/features/POST";
import admin_cms_hero_get_29 from "./api/admin/cms/hero/GET";
import admin_cms_hero_post_30 from "./api/admin/cms/hero/POST";
import admin_cms_logo_get_31 from "./api/admin/cms/logo/GET";
import admin_cms_logo_post_32 from "./api/admin/cms/logo/POST";
import admin_cms_navigation_get_33 from "./api/admin/cms/navigation/GET";
import admin_cms_navigation_post_34 from "./api/admin/cms/navigation/POST";
import admin_cms_news_get_35 from "./api/admin/cms/news/GET";
import admin_cms_news_post_36 from "./api/admin/cms/news/POST";
import admin_config_get_37 from "./api/admin/config/GET";
import admin_config_post_38 from "./api/admin/config/POST";
import admin_contacts_get_39 from "./api/admin/contacts/GET";
import admin_email_flush_post_41 from "./api/admin/email/flush/POST";
import admin_email_log_get_42 from "./api/admin/email/log/GET";
import admin_email_purge_post_43 from "./api/admin/email/purge/POST";
import admin_email_queue_get_44 from "./api/admin/email/queue/GET";
import admin_email_queue_retry_post_45 from "./api/admin/email/queue/retry/POST";
import admin_email_queue_id_delete_46 from "./api/admin/email/queue/[id]/DELETE";
import admin_email_requeue_post_47 from "./api/admin/email/requeue/POST";
import admin_email_status_get_48 from "./api/admin/email/status/GET";
import admin_email_templates_get_49 from "./api/admin/email/templates/GET";
import admin_email_templates_post_50 from "./api/admin/email/templates/POST";
import admin_email_templates_reset_post_51 from "./api/admin/email/templates/reset/POST";
import admin_email_test_post_52 from "./api/admin/email/test/POST";
import admin_health_get_54 from "./api/admin/health/GET";
import admin_integrations_get_55 from "./api/admin/integrations/GET";
import admin_integrations_post_56 from "./api/admin/integrations/POST";
import admin_integrations_test_post_57 from "./api/admin/integrations/test/POST";
import admin_kyc_approve_post_58 from "./api/admin/kyc/approve/POST";
import admin_kyc_aml_get from "./api/admin/kyc/aml/GET";
import admin_kyc_aml_post from "./api/admin/kyc/aml/POST";
import admin_kyc_extend_post_59 from "./api/admin/kyc/extend/POST";
import admin_kyc_flag_post_60 from "./api/admin/kyc/flag/POST";
import admin_kyc_note_post_61 from "./api/admin/kyc/note/POST";
import admin_kyc_queue_get_62 from "./api/admin/kyc/queue/GET";
import admin_kyc_reject_post_63 from "./api/admin/kyc/reject/POST";
import admin_kyc_request_info_post_64 from "./api/admin/kyc/request-info/POST";
import admin_kyc_settings_get_65 from "./api/admin/kyc/settings/GET";
import admin_kyc_settings_post_66 from "./api/admin/kyc/settings/POST";
import admin_kyc_stats_get_67 from "./api/admin/kyc/stats/GET";
import admin_links_get_68 from "./api/admin/links/GET";
import admin_links_post_69 from "./api/admin/links/POST";
import admin_media_get_70 from "./api/admin/media/GET";
import admin_media_post_71 from "./api/admin/media/POST";
import admin_media_replace_post_72 from "./api/admin/media/replace/POST";
import admin_newsletter_campaigns_get_73 from "./api/admin/newsletter/campaigns/GET";
import admin_newsletter_campaigns_post_74 from "./api/admin/newsletter/campaigns/POST";
import admin_newsletter_campaigns_put_75 from "./api/admin/newsletter/campaigns/PUT";
import admin_newsletter_campaigns_duplicate_post_76 from "./api/admin/newsletter/campaigns/duplicate/POST";
import admin_newsletter_campaigns_send_post_77 from "./api/admin/newsletter/campaigns/send/POST";
import admin_newsletter_subscribers_import_post_78 from "./api/admin/newsletter/subscribers/import/POST";
import admin_newsletter_subscribers_unsubscribe_post_79 from "./api/admin/newsletter/subscribers/unsubscribe/POST";
import admin_notifications_send_post_80 from "./api/admin/notifications/send/POST";
import admin_notifications_get from "./api/admin/notifications/GET";
import admin_notifications_post from "./api/admin/notifications/POST";
import admin_rates_get_81 from "./api/admin/rates/GET";
import admin_rates_fee_history_get_82 from "./api/admin/rates/fee-history/GET";
import admin_rates_fx_markup_post_83 from "./api/admin/rates/fx-markup/POST";
import admin_rates_limits_post_84 from "./api/admin/rates/limits/POST";
import admin_rates_limits_user_get_85 from "./api/admin/rates/limits/user/GET";
import admin_rates_tier_fees_post_86 from "./api/admin/rates/tier-fees/POST";
import admin_rates_tx_fees_post_87 from "./api/admin/rates/tx-fees/POST";
import admin_readiness_get_88 from "./api/admin/readiness/GET";
import admin_sponsor_readiness_get from "./api/admin/sponsor-readiness/GET";
import admin_sponsor_readiness_evidence_post from "./api/admin/sponsor-readiness/evidence/POST";
import admin_sponsor_readiness_evidence_submit_post from "./api/admin/sponsor-readiness/evidence/[id]/submit/POST";
import admin_sponsor_readiness_evidence_review_post from "./api/admin/sponsor-readiness/evidence/[id]/review/POST";
import admin_sponsor_readiness_export_get from "./api/admin/sponsor-readiness/export/GET";
import admin_sponsor_readiness_package_submit_post from "./api/admin/sponsor-readiness/package/submit/POST";
import admin_sponsor_readiness_package_review_post from "./api/admin/sponsor-readiness/package/review/POST";
import admin_sponsor_readiness_external_review_post from "./api/admin/sponsor-readiness/external-review/POST";
import admin_sponsor_readiness_external_review_get from "./api/admin/sponsor-readiness/external-review/GET";
import admin_provider_sandbox_get from "./api/admin/provider-sandbox/GET";
import admin_provider_sandbox_post from "./api/admin/provider-sandbox/POST";
import admin_financial_sandbox_get from "./api/admin/financial-sandbox/GET";
import admin_financial_sandbox_post from "./api/admin/financial-sandbox/POST";
import admin_reconciliation_get from "./api/admin/reconciliation/GET";
import admin_reconciliation_post from "./api/admin/reconciliation/POST";
import admin_disputes_get from "./api/admin/disputes/GET";
import admin_disputes_post from "./api/admin/disputes/POST";
import admin_customer_accounts_get from "./api/admin/customer-accounts/GET";
import admin_customer_accounts_post from "./api/admin/customer-accounts/POST";
import admin_customer_relationships_get from "./api/admin/customer-relationships/GET";
import admin_customer_relationships_post from "./api/admin/customer-relationships/POST";
import admin_assurance_exercises_get from "./api/admin/assurance-exercises/GET";
import admin_assurance_exercises_post from "./api/admin/assurance-exercises/POST";
import admin_reports_get_89 from "./api/admin/reports/GET";
import admin_security_alerts_get_90 from "./api/admin/security/alerts/GET";
import admin_security_alerts_post_91 from "./api/admin/security/alerts/POST";
import admin_security_devices_delete_92 from "./api/admin/security/devices/DELETE";
import admin_security_devices_get_93 from "./api/admin/security/devices/GET";
import admin_security_export_get_94 from "./api/admin/security/export/GET";
import admin_security_ip_lists_get_95 from "./api/admin/security/ip-lists/GET";
import admin_security_ip_lists_post_96 from "./api/admin/security/ip-lists/POST";
import admin_security_rate_limits_get_97 from "./api/admin/security/rate-limits/GET";
import admin_security_rate_limits_post_98 from "./api/admin/security/rate-limits/POST";
import admin_security_roles_get_99 from "./api/admin/security/roles/GET";
import admin_security_roles_post_100 from "./api/admin/security/roles/POST";
import admin_security_sessions_delete_101 from "./api/admin/security/sessions/DELETE";
import admin_security_sessions_get_102 from "./api/admin/security/sessions/GET";
import admin_security_sessions_patch_103 from "./api/admin/security/sessions/PATCH";
import admin_security_threats_get_104 from "./api/admin/security/threats/GET";
import admin_security_threats_patch_105 from "./api/admin/security/threats/PATCH";
import admin_security_two_fa_get_106 from "./api/admin/security/two-fa/GET";
import admin_security_two_fa_post_107 from "./api/admin/security/two-fa/POST";
import admin_settings_get_108 from "./api/admin/settings/GET";
import admin_settings_post_109 from "./api/admin/settings/POST";
import admin_settings_rates_get_110 from "./api/admin/settings/rates/GET";
import admin_settings_rates_post_111 from "./api/admin/settings/rates/POST";
import admin_smtp_config_get_123 from "./api/admin/smtp/config/GET";
import admin_smtp_config_post_124 from "./api/admin/smtp/config/POST";
import admin_smtp_mode_post_125 from "./api/admin/smtp/mode/POST";
import admin_smtp_status_get_126 from "./api/admin/smtp/status/GET";
import admin_smtp_test_post_127 from "./api/admin/smtp/test/POST";
import admin_smtp_test_template_post_128 from "./api/admin/smtp/test-template/POST";
import admin_smtp_verify_post_129 from "./api/admin/smtp/verify/POST";
import admin_social_get_130 from "./api/admin/social/GET";
import admin_social_post_131 from "./api/admin/social/POST";
import admin_social_share_post from "./api/admin/social/share/POST";
import admin_social_share_opened_post from "./api/admin/social/share/opened/POST";
import admin_stats_get_132 from "./api/admin/stats/GET";
import admin_support_get_133 from "./api/admin/support/GET";
import admin_support_announcements_get_134 from "./api/admin/support/announcements/GET";
import admin_support_announcements_post_135 from "./api/admin/support/announcements/POST";
import admin_support_assign_post_136 from "./api/admin/support/assign/POST";
import admin_support_bulk_post_137 from "./api/admin/support/bulk/POST";
import admin_support_canned_delete_138 from "./api/admin/support/canned/DELETE";
import admin_support_canned_get_139 from "./api/admin/support/canned/GET";
import admin_support_canned_post_140 from "./api/admin/support/canned/POST";
import admin_support_canned_put_141 from "./api/admin/support/canned/PUT";
import admin_support_complaints_get_142 from "./api/admin/support/complaints/GET";
import admin_support_complaints_post_143 from "./api/admin/support/complaints/POST";
import admin_support_contact_forms_get_144 from "./api/admin/support/contact-forms/GET";
import admin_support_contact_forms_post_145 from "./api/admin/support/contact-forms/POST";
import admin_support_feedback_get_146 from "./api/admin/support/feedback/GET";
import admin_support_feedback_post_147 from "./api/admin/support/feedback/POST";
import admin_support_messages_get_148 from "./api/admin/support/messages/GET";
import admin_support_messages_post_149 from "./api/admin/support/messages/POST";
import admin_support_note_post_150 from "./api/admin/support/note/POST";
import admin_support_notifications_get_151 from "./api/admin/support/notifications/GET";
import admin_support_notifications_post_152 from "./api/admin/support/notifications/POST";
import admin_support_priority_post_153 from "./api/admin/support/priority/POST";
import admin_support_reply_post_154 from "./api/admin/support/reply/POST";
import admin_support_routing_get_155 from "./api/admin/support/routing/GET";
import admin_support_routing_post_156 from "./api/admin/support/routing/POST";
import admin_support_stats_get_157 from "./api/admin/support/stats/GET";
import admin_support_status_post_158 from "./api/admin/support/status/POST";
import admin_tickets_get_159 from "./api/admin/tickets/GET";
import admin_tickets_replies_get_160 from "./api/admin/tickets/replies/GET";
import admin_tickets_reply_post_161 from "./api/admin/tickets/reply/POST";
import admin_trading_get_162 from "./api/admin/trading/GET";
import admin_trading_active_traders_get_163 from "./api/admin/trading/active-traders/GET";
import admin_trading_fees_get_164 from "./api/admin/trading/fees/GET";
import admin_trading_fees_post_165 from "./api/admin/trading/fees/POST";
import admin_trading_freeze_get_166 from "./api/admin/trading/freeze/GET";
import admin_trading_freeze_post_167 from "./api/admin/trading/freeze/POST";
import admin_trading_markets_get_168 from "./api/admin/trading/markets/GET";
import admin_trading_markets_put_169 from "./api/admin/trading/markets/PUT";
import admin_trading_markets_suspend_post_170 from "./api/admin/trading/markets/suspend/POST";
import admin_trading_providers_get_171 from "./api/admin/trading/providers/GET";
import admin_trading_providers_put_172 from "./api/admin/trading/providers/PUT";
import admin_transactions_get_173 from "./api/admin/transactions/GET";
import admin_transactions_approve_post_174 from "./api/admin/transactions/approve/POST";
import admin_transactions_create_post_175 from "./api/admin/transactions/create/POST";
import admin_transactions_edit_post from "./api/admin/transactions/edit/POST";
import admin_transactions_freeze_post_176 from "./api/admin/transactions/freeze/POST";
import admin_transactions_real_get_177 from "./api/admin/transactions/real/GET";
import admin_transactions_reject_post_178 from "./api/admin/transactions/reject/POST";
import admin_users_get_179 from "./api/admin/users/GET";
import admin_users_action_post_180 from "./api/admin/users/action/POST";
import admin_users_approve_post_181 from "./api/admin/users/approve/POST";
import admin_users_create_post_182 from "./api/admin/users/create/POST";
import admin_users_currency_post_183 from "./api/admin/users/currency/POST";
import admin_users_delete_post_184 from "./api/admin/users/delete/POST";
import admin_users_edit_post_185 from "./api/admin/users/edit/POST";
import admin_users_override_post_186 from "./api/admin/users/override/POST";
import admin_users_reject_post_187 from "./api/admin/users/reject/POST";
import admin_users_reset_2fa_post_188 from "./api/admin/users/reset-2fa/POST";
import admin_users_reset_password_post_189 from "./api/admin/users/reset-password/POST";
import admin_users_id_audit_get_190 from "./api/admin/users/[id]/audit/GET";
import admin_users_id_devices_get_191 from "./api/admin/users/[id]/devices/GET";
import admin_users_id_login_history_get_192 from "./api/admin/users/[id]/login-history/GET";
import admin_users_id_security_events_get_193 from "./api/admin/users/[id]/security-events/GET";
import admin_wallets_get_194 from "./api/admin/wallets/GET";
import admin_wallets_patch_195 from "./api/admin/wallets/PATCH";
import admin_website_get_196 from "./api/admin/website/GET";
import admin_website_post_197 from "./api/admin/website/POST";
import admin_zoho_exchange_post_198 from "./api/admin/zoho/exchange/POST";
import admin_zoho_oauth_callback_get_199 from "./api/admin/zoho/oauth/callback/GET";
import analytics_ab_results_get_200 from "./api/analytics/ab-results/GET";
import analytics_conversions_get_201 from "./api/analytics/conversions/GET";
import analytics_event_post_202 from "./api/analytics/event/POST";
import analytics_summary_get_203 from "./api/analytics/summary/GET";
import chat_post_204 from "./api/chat/POST";
import cms_content_get_205 from "./api/cms/content/GET";
import cms_homepage_get from "./api/cms/homepage/GET";
import config_tawk_widget_get_206 from "./api/config/tawk-widget/GET";
import contact_post_207 from "./api/contact/POST";
import csrf_get_208 from "./api/csrf/GET";
import health_get_209 from "./api/health/GET";
import market_candles_get_210 from "./api/market/candles/GET";
import market_orderbook_get_211 from "./api/market/orderbook/GET";
import market_providers_get_212 from "./api/market/providers/GET";
import market_search_get_213 from "./api/market/search/GET";
import market_stream_get_214 from "./api/market/stream/GET";
import market_summary_get_215 from "./api/market/summary/GET";
import market_ticker_get_216 from "./api/market/ticker/GET";
import newsletter_send_sequence_post_217 from "./api/newsletter/send-sequence/POST";
import newsletter_subscribe_post_218 from "./api/newsletter/subscribe/POST";
import newsletter_subscribers_get_219 from "./api/newsletter/subscribers/GET";
import newsletter_unsubscribe_get_220 from "./api/newsletter/unsubscribe/GET";
import og_get_221 from "./api/og/GET";
import settings_rates_get_222 from "./api/settings/rates/GET";
import settings_social_get_223 from "./api/settings/social/GET";
import settings_website_get from "./api/settings/website/GET";
import users_2fa_setup_post_225 from "./api/users/2fa/setup/POST";
import users_2fa_verify_post_226 from "./api/users/2fa/verify/POST";
import users_avatar_post_227 from "./api/users/avatar/POST";
import users_balance_get_228 from "./api/users/balance/GET";
import users_beneficiaries_get_229 from "./api/users/beneficiaries/GET";
import users_beneficiaries_add_post_230 from "./api/users/beneficiaries/add/POST";
import users_beneficiaries_delete_post_231 from "./api/users/beneficiaries/delete/POST";
import users_beneficiaries_update_post_232 from "./api/users/beneficiaries/update/POST";
import users_accounts_get from "./api/users/accounts/GET";
import users_cards_get_233 from "./api/users/cards/GET";
import users_cards_delete_post_234 from "./api/users/cards/delete/POST";
import users_cards_freeze_post_235 from "./api/users/cards/freeze/POST";
import users_cards_generate_post_236 from "./api/users/cards/generate/POST";
import users_cards_request_post_237 from "./api/users/cards/request/POST";
import users_deposit_post_238 from "./api/users/deposit/POST";
import users_devices_get_239 from "./api/users/devices/GET";
import users_devices_revoke_post_240 from "./api/users/devices/revoke/POST";
import users_kyc_document_post_241 from "./api/users/kyc-document/POST";
import users_login_post_242 from "./api/users/login/POST";
import users_login_history_get_243 from "./api/users/login-history/GET";
import users_logout_post_244 from "./api/users/logout/POST";
import users_me_patch_245 from "./api/users/me/PATCH";
import users_notifications_get_246 from "./api/users/notifications/GET";
import users_notifications_delete_post_247 from "./api/users/notifications/delete/POST";
import users_notifications_preferences_get_248 from "./api/users/notifications/preferences/GET";
import users_notifications_preferences_post_249 from "./api/users/notifications/preferences/POST";
import users_notifications_read_post_250 from "./api/users/notifications/read/POST";
import users_password_reset_post_251 from "./api/users/password-reset/POST";
import users_password_reset_confirm_post_252 from "./api/users/password-reset/confirm/POST";
import users_profile_put_253 from "./api/users/profile/PUT";
import users_register_post_254 from "./api/users/register/POST";
import users_security_events_get_255 from "./api/users/security/events/GET";
import users_security_sessions_get_256 from "./api/users/security/sessions/GET";
import users_security_sessions_revoke_post_257 from "./api/users/security/sessions/revoke/POST";
import users_security_sessions_revoke_all_post_258 from "./api/users/security/sessions/revoke-all/POST";
import users_session_get_258 from "./api/users/session/GET";
import users_support_get_259 from "./api/users/support/GET";
import users_support_post_260 from "./api/users/support/POST";
import users_swap_post_261 from "./api/users/swap/POST";
import users_trading_alerts_get_262 from "./api/users/trading/alerts/GET";
import users_trading_alerts_post_263 from "./api/users/trading/alerts/POST";
import users_trading_analytics_get_264 from "./api/users/trading/analytics/GET";
import users_trading_history_get_265 from "./api/users/trading/history/GET";
import users_trading_market_data_get_266 from "./api/users/trading/market-data/GET";
import users_trading_orders_get_267 from "./api/users/trading/orders/GET";
import users_trading_orders_post_268 from "./api/users/trading/orders/POST";
import users_trading_orders_cancel_post_269 from "./api/users/trading/orders/cancel/POST";
import users_trading_portfolio_get_270 from "./api/users/trading/portfolio/GET";
import users_trading_summary_get_271 from "./api/users/trading/summary/GET";
import users_trading_watchlist_get_272 from "./api/users/trading/watchlist/GET";
import users_trading_watchlist_post_273 from "./api/users/trading/watchlist/POST";
import users_transactions_get_274 from "./api/users/transactions/GET";
import users_transactions_receipt_get from "./api/users/transactions/receipt/GET";
import users_disputes_get from "./api/users/disputes/GET";
  import users_disputes_post from "./api/users/disputes/POST";
  import users_goals_get from "./api/users/goals/GET";
  import users_goals_post from "./api/users/goals/POST";
  import users_bills_get from "./api/users/bills/GET";
  import users_bills_post from "./api/users/bills/POST";
  import users_rewards_get from "./api/users/rewards/GET";
  import users_search_get from "./api/users/search/GET";
  import admin_search_get from "./api/admin/search/GET";
import users_transfer_post_275 from "./api/users/transfer/POST";
import users_transfers_get_276 from "./api/users/transfers/GET";
import users_transfers_post_277 from "./api/users/transfers/POST";
import users_verify_email_get_278 from "./api/users/verify-email/GET";
import users_wallet_overview_get_279 from "./api/users/wallet-overview/GET";
import users_withdraw_post_280 from "./api/users/withdraw/POST";
import users_plaid_get from "./api/users/plaid/GET";
import users_plaid_link_token_post from "./api/users/plaid/link-token/POST";
import users_plaid_exchange_post from "./api/users/plaid/exchange/POST";
import users_plaid_disconnect_post from "./api/users/plaid/disconnect/POST";
import zoho_callback_get_281 from "./api/zoho/callback/GET";
import zoho_connect_get_282 from "./api/zoho/connect/GET";
import zoho_status_get_283 from "./api/zoho/status/GET";
// </api-imports>
import { startEmailQueueWorker } from "./lib/emailQueue";
import { requireAdminAuth } from "./lib/adminAuthMiddleware";
import { requireAdminAuthorization } from "./lib/adminAuthorizationMiddleware";
import { enforceSecurityNetworkPolicy } from "./lib/securityNetworkPolicyMiddleware";
import { csrfProtect } from "./api/csrf/GET";
import { auditAdminMutation } from "./lib/adminMutationAuditMiddleware";
import { requireCustomerAuth, requireCustomerSameOrigin } from "./lib/customerAuthMiddleware";
import { sendEmail as smtpSendEmail } from "./lib/smtpTransport";
import { seoRoutes } from "../lib/seo-routes";
import { logStartupCredentialState } from "./lib/zohoTokenStore";
import { loadSmtpConfigFromDb } from "./lib/smtpConfigStore";
import { loadConfigFromDb } from "./lib/configStore";
import { syncLegacySupportConversations } from "./lib/supportDatabaseStore";
import { loadEmailBrandingFromDb } from "./lib/emailBrandingStore";
import { loadEmailTemplatesFromDb } from "./lib/emailTemplateStore";
import { loadRatesConfigFromDb } from "./lib/ratesStore";
import { getSecret } from "#runtime/secrets";
import { validateEnvAtStartup } from "./lib/envValidator";
import { APP_ENV } from "./lib/envConfig";
// Note: admin_reports_get_89 and admin_readiness_get_88
// are imported above in the <api-imports> block and
// registered at their respective app.get() lines. No duplicate imports needed.
import { initMarketProviders } from "./lib/market/init";
import { startOperationalBackupWorker } from "./lib/operationalBackup";
import { marketRegistry } from "./lib/market/registry";
import { migrateCardsToEncrypted } from "./lib/cardStore";

function normalizeCommerceApiBaseUrlEnv() {
	if (process.env.GODADDY_API_BASE_URL) return;
	const hostOnly = process.env.VITE_GODADDY_API_HOST;
	if (!hostOnly) return;
	const normalizedHost = hostOnly.startsWith('https://') ? hostOnly.slice(8) : hostOnly.startsWith('http://') ? hostOnly.slice(7) : hostOnly;
	if (!normalizedHost) return;
	process.env.GODADDY_API_BASE_URL = `https://${normalizedHost}`;
}

normalizeCommerceApiBaseUrlEnv();


const app = express();

// Website publication is separate from live financial operations. A public
// informational site may be indexed while PLATFORM_MODE remains preview and
// all money-moving routes stay fail-closed.
if (process.env.PUBLIC_SITE_PUBLISHED !== '1') {
  app.use((req, res, next) => {
    if (isSystemHost(req)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    }
    next();
  });
}

// ── Environment validation (runs before any route handlers) ─────────────────
// Validates all required secrets/env vars. CRITICAL missing vars exit(1) in
// production; WARNING vars log and continue. See src/server/lib/envValidator.ts
validateEnvAtStartup();
console.log(JSON.stringify({ event: 'server.startup', environment: APP_ENV }));

// Customer-facing rates and limits must be loaded from the durable store
// before any route can calculate or display financial configuration.
const ratesConfigReady = loadRatesConfigFromDb();
app.use(async (_req, res, next) => {
	try {
		await ratesConfigReady;
		next();
	} catch (error) {
		console.error(JSON.stringify({
			event: 'rates.config.load_failed',
			error: error instanceof Error ? error.message : 'UnknownError',
		}));
		res.status(503).json({ error: 'Financial configuration is temporarily unavailable.' });
	}
});

// ── Security & performance ──────────────────────────────────────────────────
app.set("trust proxy", true);
app.use(removeFingerprinting);
app.use(enforceHttps);
// Path hardening must run before securityHeaders and all route handlers
// so traversal/malformed URLs are rejected before the SPA fallback can
// serve a misleading HTTP 200 shell.
app.use(pathHardeningMiddleware);
app.use(securityHeaders);
// Compress text responses ≥ 1 KB; skip already-compressed formats
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    const ct = String(res.getHeader('Content-Type') ?? '');
    // Use startsWith checks instead of a complex alternation regex to avoid
    // ReDoS risk on attacker-controlled Content-Type values.
    const SKIP_PREFIXES = [
      'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
      'image/webp', 'image/avif', 'video/', 'audio/',
      'application/zip', 'application/gzip', 'application/br',
      'application/zstd', 'application/wasm',
    ];
    if (SKIP_PREFIXES.some(p => ct.startsWith(p))) return false;
    return compression.filter(req, res);
  },
}));
app.use(cookieParser());

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(requestSizeGuard(512));
app.use(express.json({
  limit: '512kb',
  verify: (req, _res, buffer) => {
    if ((req as Request).originalUrl.startsWith('/api/providers/onboarding/webhook/')
      || (req as Request).originalUrl.startsWith('/api/webhooks/resend')) {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

// ── HTTP access logger (after body parsing, before routes) ──────────────────
app.use(httpLogger);

// ── Global API rate limit (200 req/min per IP) ──────────────────────────────
app.use('/api', rateLimitMiddleware(
  req => `global:${req.ip}`,
  { windowMs: 60_000, max: 200 },
  'Rate limit exceeded. Please slow down.',
));
// ── API cache headers (no-store for all /api routes) ────────────────────────
app.use('/api', apiCacheHeaders);

// Apply durable administrator-managed network blocks before public login or
// authenticated administration/customer handlers are reached.
app.use(['/api/admin', '/api/users'], enforceSecurityNetworkPolicy);

app.use('/api/providers/onboarding/webhook', rateLimitMiddleware(
  req => `provider-webhook:${req.ip}`,
  { windowMs: 60_000, max: 60 },
  'Provider webhook rate limit exceeded.',
));

app.use('/api/webhooks/resend', rateLimitMiddleware(
  req => `resend-webhook:${req.ip}`,
  { windowMs: 60_000, max: 120 },
  'Email webhook rate limit exceeded.',
));

app.use('/api/admin/sponsor-readiness/external-review', rateLimitMiddleware(
  req => `sponsor-external-review:${req.ip}`,
  { windowMs: 60_000, max: 10 },
  'Independent sponsor review rate limit exceeded.',
));

// ── Force JSON-only responses on all /api routes ─────────────────────────────
// Prevents Express default HTML error pages from reaching clients.
// The JSON error handler registered after route registrations catches any
// unhandled errors and returns structured JSON instead of Express HTML pages.
app.use('/api', (_req: Request, _res: Response, next: NextFunction) => { next(); });

// ── Admin route authentication ──────────────────────────────────────────────
// All /api/admin/* routes require a valid admin session EXCEPT the public
// bootstrap/recovery endpoints (login, password-reset, OTP verify, unlock) which
// must be reachable before a session exists.
// The diag endpoint is excluded here — it has its own ADMIN_UNLOCK_KEY guard.
// NOTE: inside app.use('/api/admin', fn), req.path is the suffix AFTER
// '/api/admin', e.g. '/auth/login' for POST /api/admin/auth/login.
app.use('/api/admin', (req: Request, res: Response, next: NextFunction) => {
  const PUBLIC_SUFFIXES = new Set([
    '/auth/login',
    '/auth/password-reset',
    '/auth/password-reset/confirm',
    '/auth/otp/verify',
    '/auth/otp/resend',
    '/auth/diag',
    '/auth/verify',          // lightweight session check — used by login page
    '/zoho/oauth/callback',  // Zoho redirects here — no session yet
    '/sponsor-readiness/external-review',
  ]);
  const suffix = req.path.endsWith('/') && req.path.length > 1 ? req.path.slice(0, -1) : req.path || '/';
  if (PUBLIC_SUFFIXES.has(suffix)) return next();
  return requireAdminAuth(req, res, next);
});

// Authentication alone is not authorization. Apply a fail-closed role policy
// before any administration handler is registered so new routes cannot become
// available to every administrator by accident.
app.use('/api/admin', requireAdminAuthorization);

// Cookie-authenticated administration writes require a matching double-submit
// token. Public authentication routes have no admin session and are skipped.
app.use('/api/admin', (req: Request, res: Response, next: NextFunction) => {
  if (!req.adminSession) return next();
  return csrfProtect(req, res, next);
});
app.use('/api/admin', auditAdminMutation);

// Customer APIs are protected centrally.  Keep the small unauthenticated
// onboarding/reset surface explicit so newly added /api/users routes are not
// accidentally exposed by relying on each handler to authenticate itself.
// Every customer mutation, including public login and registration, must come
// from the exact website origin. This prevents login CSRF as well as attacks
// against cookie-authenticated routes.
app.use('/api/users/register', rateLimitMiddleware(
  (req) => `customer-registration:${req.ip ?? 'unknown'}`,
  { windowMs: 60 * 60_000, max: 5 },
  'Too many registration attempts. Please try again later.',
));
app.use('/api/users', requireCustomerSameOrigin);
app.use('/api/users', (req: Request, res: Response, next: NextFunction) => {
  const PUBLIC_SUFFIXES = new Set([
    '/register',
    '/login',
    '/verify-email',
    '/password-reset',
    '/password-reset/confirm',
    '/kyc-document', // validates either a customer session or a short-lived purpose token
  ]);
  const suffix = req.path.endsWith('/') && req.path.length > 1 ? req.path.slice(0, -1) : req.path || '/';
  if (PUBLIC_SUFFIXES.has(suffix)) return next();
  return requireCustomerAuth(req, res, next);
});
app.use('/api/users', requireEnabledCustomerFeature);

// Public visitors may submit consented, data-minimised events. Analytics reports
// and every other analytics route remain administrator-only.
app.use('/api/analytics/event', rateLimitMiddleware(
  (req) => `analytics:${req.ip ?? 'unknown'}`,
  { windowMs: 60_000, max: 30 },
  'Analytics event rate limit exceeded.',
));
app.use('/api/analytics', (req: Request, res: Response, next: NextFunction) => {
  const suffix = req.path.endsWith('/') && req.path.length > 1 ? req.path.slice(0, -1) : req.path;
  if (req.method === 'POST' && suffix === '/event') return next();
  return requireAdminAuth(req, res, next);
});
app.use('/api/newsletter/subscribers', requireAdminAuth);
app.use('/api/newsletter/send-sequence', requireAdminAuth);
app.use('/api/newsletter/subscribers', csrfProtect);
app.use('/api/newsletter/send-sequence', csrfProtect);

// Zoho diagnostics and OAuth initiation expose sensitive integration state.
// Keep the callback public so Zoho can complete the redirect, but require a
// security or super administrator to begin or inspect the flow.
app.use(['/api/zoho/connect', '/api/zoho/status'], requireAdminAuth);
app.use(['/api/zoho/connect', '/api/zoho/status'], (req: Request, res: Response, next: NextFunction) => {
  if (req.adminSession?.role === 'SUPER_ADMIN' || req.adminSession?.role === 'SECURITY_ADMIN') return next();
  return res.status(403).json({ error: 'Security administrator permission required' });
});

// <api-registrations>
app.get("/api/platform/features", platform_features_get);
app.post("/api/providers/onboarding/webhook/:provider", providers_onboarding_webhook_post);
app.post("/api/webhooks/resend", resend_webhook_post);
app.get("/api/admin/onboarding/screening", admin_onboarding_screening_get);
app.get("/api/admin/legal-entity", admin_legal_entity_get);
app.post("/api/admin/legal-entity", admin_legal_entity_post);
app.post("/api/admin/legal-entity/owners", admin_legal_entity_owners_post);
app.get("/api/admin/kyc/document", admin_kyc_document_get);
app.get("/api/admin/onboarding", admin_onboarding_get);
app.post("/api/admin/onboarding/review", admin_onboarding_review_post);
app.get("/api/admin/onboarding/compliance-cases", admin_onboarding_compliance_cases_get);
app.post("/api/admin/onboarding/compliance-cases", admin_onboarding_compliance_cases_post);
app.get("/api/admin/onboarding/monitoring", admin_onboarding_monitoring_get);
app.post("/api/admin/onboarding/monitoring", admin_onboarding_monitoring_post);
app.post("/api/accounts/apply", accounts_apply_post_0);
app.get("/api/admin/audit", admin_audit_get_1);
app.get("/api/admin/auth/diag", admin_auth_diag_get_2);
app.post("/api/admin/auth/login", admin_auth_login_post_3);
app.post("/api/admin/auth/logout", admin_auth_logout_post_4);
app.post("/api/admin/auth/otp/verify", admin_auth_otp_verify_post_5);
app.post("/api/admin/auth/otp/resend", admin_auth_otp_resend_post);
app.post("/api/admin/auth/password-reset", admin_auth_password_reset_post_6);
app.post("/api/admin/auth/password-reset/confirm", admin_auth_password_reset_confirm_post_7);
app.delete("/api/admin/auth/trusted-devices", admin_auth_trusted_devices_delete_8);
app.get("/api/admin/auth/trusted-devices", admin_auth_trusted_devices_get_9);
app.post("/api/admin/auth/unlock", admin_auth_unlock_post_10);
app.get("/api/admin/auth/verify", admin_auth_verify_get_11);
app.post("/api/admin/balance/adjust", admin_balance_adjust_post_12);
app.get("/api/admin/balance/history", admin_balance_history_get_13);
app.get("/api/admin/cards", admin_cards_get_14);
app.post("/api/admin/cards/freeze", admin_cards_freeze_post_15);
app.post("/api/admin/cards/issue", admin_cards_issue_post_16);
app.post("/api/admin/cards/pin", admin_cards_pin_post_17);
app.post("/api/admin/cards/replace", admin_cards_replace_post_18);
app.post("/api/admin/cards/spending-limit", admin_cards_spending_limit_post_19);
app.get("/api/admin/cards/:id/activity", admin_cards_id_activity_get_20);
app.get("/api/admin/chatbot", admin_chatbot_get_21);
app.post("/api/admin/chatbot", admin_chatbot_post_22);
app.get("/api/admin/cms", admin_cms_get_23);
app.post("/api/admin/cms", admin_cms_post_24);
app.get("/api/admin/cms/homepage", admin_cms_homepage_get);
app.post("/api/admin/cms/homepage", admin_cms_homepage_post);
app.get("/api/admin/cms/blog", admin_cms_blog_get_25);
app.post("/api/admin/cms/blog", admin_cms_blog_post_26);
app.get("/api/admin/cms/features", admin_cms_features_get_27);
app.post("/api/admin/cms/features", admin_cms_features_post_28);
app.get("/api/admin/cms/hero", admin_cms_hero_get_29);
app.post("/api/admin/cms/hero", admin_cms_hero_post_30);
app.get("/api/admin/cms/logo", admin_cms_logo_get_31);
app.post("/api/admin/cms/logo", admin_cms_logo_post_32);
app.get("/api/admin/cms/navigation", admin_cms_navigation_get_33);
app.post("/api/admin/cms/navigation", admin_cms_navigation_post_34);
app.get("/api/admin/cms/news", admin_cms_news_get_35);
app.post("/api/admin/cms/news", admin_cms_news_post_36);
app.get("/api/admin/config", admin_config_get_37);
app.post("/api/admin/config", admin_config_post_38);
app.get("/api/admin/features", admin_features_get);
app.get("/api/admin/contacts", admin_contacts_get_39);
app.get("/api/admin/operations", admin_operations_get);
app.post("/api/admin/operations", admin_operations_post);
app.get("/api/admin/documentation/:format", admin_documentation_format_get);
app.post("/api/admin/email/flush", admin_email_flush_post_41);
app.get("/api/admin/email/log", admin_email_log_get_42);
app.post("/api/admin/email/purge", admin_email_purge_post_43);
app.get("/api/admin/email/queue", admin_email_queue_get_44);
app.post("/api/admin/email/queue/retry", admin_email_queue_retry_post_45);
app.delete("/api/admin/email/queue/:id", admin_email_queue_id_delete_46);
app.post("/api/admin/email/requeue", admin_email_requeue_post_47);
app.get("/api/admin/email/status", admin_email_status_get_48);
app.get("/api/admin/email/templates", admin_email_templates_get_49);
app.post("/api/admin/email/templates", admin_email_templates_post_50);
app.post("/api/admin/email/templates/reset", admin_email_templates_reset_post_51);
app.post("/api/admin/email/test", admin_email_test_post_52);
app.get("/api/admin/health", admin_health_get_54);
app.get("/api/admin/integrations", admin_integrations_get_55);
app.post("/api/admin/integrations", admin_integrations_post_56);
app.post("/api/admin/integrations/test", admin_integrations_test_post_57);
app.post("/api/admin/kyc/approve", admin_kyc_approve_post_58);
app.get("/api/admin/kyc/aml", admin_kyc_aml_get);
app.post("/api/admin/kyc/aml", admin_kyc_aml_post);
app.post("/api/admin/kyc/extend", admin_kyc_extend_post_59);
app.post("/api/admin/kyc/flag", admin_kyc_flag_post_60);
app.post("/api/admin/kyc/note", admin_kyc_note_post_61);
app.get("/api/admin/kyc/queue", admin_kyc_queue_get_62);
app.post("/api/admin/kyc/reject", admin_kyc_reject_post_63);
app.post("/api/admin/kyc/request-info", admin_kyc_request_info_post_64);
app.get("/api/admin/kyc/settings", admin_kyc_settings_get_65);
app.post("/api/admin/kyc/settings", admin_kyc_settings_post_66);
app.get("/api/admin/kyc/stats", admin_kyc_stats_get_67);
app.get("/api/admin/links", admin_links_get_68);
app.post("/api/admin/links", admin_links_post_69);
app.get("/api/admin/media", admin_media_get_70);
app.post("/api/admin/media", admin_media_post_71);
app.post("/api/admin/media/replace", admin_media_replace_post_72);
app.get("/api/admin/newsletter/campaigns", admin_newsletter_campaigns_get_73);
app.post("/api/admin/newsletter/campaigns", admin_newsletter_campaigns_post_74);
app.put("/api/admin/newsletter/campaigns", admin_newsletter_campaigns_put_75);
app.post("/api/admin/newsletter/campaigns/duplicate", admin_newsletter_campaigns_duplicate_post_76);
app.post("/api/admin/newsletter/campaigns/send", admin_newsletter_campaigns_send_post_77);
app.post("/api/admin/newsletter/subscribers/import", admin_newsletter_subscribers_import_post_78);
app.post("/api/admin/newsletter/subscribers/unsubscribe", admin_newsletter_subscribers_unsubscribe_post_79);
app.post("/api/admin/notifications/send", admin_notifications_send_post_80);
app.get("/api/admin/notifications", admin_notifications_get);
app.post("/api/admin/notifications", admin_notifications_post);
app.get("/api/admin/rates", admin_rates_get_81);
app.get("/api/admin/rates/fee-history", admin_rates_fee_history_get_82);
app.post("/api/admin/rates/fx-markup", admin_rates_fx_markup_post_83);
app.post("/api/admin/rates/limits", admin_rates_limits_post_84);
app.get("/api/admin/rates/limits/user", admin_rates_limits_user_get_85);
app.post("/api/admin/rates/tier-fees", admin_rates_tier_fees_post_86);
app.post("/api/admin/rates/tx-fees", admin_rates_tx_fees_post_87);
app.get("/api/admin/readiness", admin_readiness_get_88);
app.get("/api/admin/sponsor-readiness", admin_sponsor_readiness_get);
app.post("/api/admin/sponsor-readiness/evidence", admin_sponsor_readiness_evidence_post);
app.post("/api/admin/sponsor-readiness/evidence/:id/submit", admin_sponsor_readiness_evidence_submit_post);
app.post("/api/admin/sponsor-readiness/evidence/:id/review", admin_sponsor_readiness_evidence_review_post);
app.get("/api/admin/sponsor-readiness/export", admin_sponsor_readiness_export_get);
app.post("/api/admin/sponsor-readiness/package/submit", admin_sponsor_readiness_package_submit_post);
app.post("/api/admin/sponsor-readiness/package/review", admin_sponsor_readiness_package_review_post);
app.get("/api/admin/sponsor-readiness/external-review", admin_sponsor_readiness_external_review_get);
app.post("/api/admin/sponsor-readiness/external-review", admin_sponsor_readiness_external_review_post);
app.get("/api/admin/provider-sandbox", admin_provider_sandbox_get);
app.post("/api/admin/provider-sandbox", admin_provider_sandbox_post);
app.get("/api/admin/financial-sandbox", admin_financial_sandbox_get);
app.post("/api/admin/financial-sandbox", admin_financial_sandbox_post);
app.get("/api/admin/reconciliation", admin_reconciliation_get);
app.post("/api/admin/reconciliation", admin_reconciliation_post);
app.get("/api/admin/disputes", admin_disputes_get);
app.post("/api/admin/disputes", admin_disputes_post);
app.get("/api/admin/customer-accounts", admin_customer_accounts_get);
app.post("/api/admin/customer-accounts", admin_customer_accounts_post);
app.get("/api/admin/customer-relationships", admin_customer_relationships_get);
app.post("/api/admin/customer-relationships", admin_customer_relationships_post);
app.get("/api/admin/assurance-exercises", admin_assurance_exercises_get);
app.post("/api/admin/assurance-exercises", admin_assurance_exercises_post);
app.get("/api/admin/reports", admin_reports_get_89);
app.get("/api/admin/security/alerts", admin_security_alerts_get_90);
app.post("/api/admin/security/alerts", admin_security_alerts_post_91);
app.delete("/api/admin/security/devices", admin_security_devices_delete_92);
app.get("/api/admin/security/devices", admin_security_devices_get_93);
app.get("/api/admin/security/export", admin_security_export_get_94);
app.get("/api/admin/security/logs", admin_security_logs_get);
app.get("/api/admin/security/ip-lists", admin_security_ip_lists_get_95);
app.post("/api/admin/security/ip-lists", admin_security_ip_lists_post_96);
app.get("/api/admin/security/rate-limits", admin_security_rate_limits_get_97);
app.post("/api/admin/security/rate-limits", admin_security_rate_limits_post_98);
app.get("/api/admin/security/roles", admin_security_roles_get_99);
app.post("/api/admin/security/roles", admin_security_roles_post_100);
app.delete("/api/admin/security/sessions", admin_security_sessions_delete_101);
app.get("/api/admin/security/sessions", admin_security_sessions_get_102);
app.patch("/api/admin/security/sessions", admin_security_sessions_patch_103);
app.get("/api/admin/security/threats", admin_security_threats_get_104);
app.patch("/api/admin/security/threats", admin_security_threats_patch_105);
app.get("/api/admin/security/two-fa", admin_security_two_fa_get_106);
app.post("/api/admin/security/two-fa", admin_security_two_fa_post_107);
app.get("/api/admin/settings", admin_settings_get_108);
app.post("/api/admin/settings", admin_settings_post_109);
app.get("/api/admin/settings/rates", admin_settings_rates_get_110);
app.post("/api/admin/settings/rates", admin_settings_rates_post_111);
app.get("/api/admin/smtp/config", admin_smtp_config_get_123);
app.post("/api/admin/smtp/config", admin_smtp_config_post_124);
app.post("/api/admin/smtp/mode", admin_smtp_mode_post_125);
app.get("/api/admin/smtp/status", admin_smtp_status_get_126);
app.post("/api/admin/smtp/test", admin_smtp_test_post_127);
app.post("/api/admin/smtp/test-template", admin_smtp_test_template_post_128);
app.post("/api/admin/smtp/verify", admin_smtp_verify_post_129);
app.get("/api/admin/social", admin_social_get_130);
app.post("/api/admin/social", admin_social_post_131);
app.post("/api/admin/social/share", admin_social_share_post);
app.post("/api/admin/social/share/opened", admin_social_share_opened_post);
app.get("/api/admin/stats", admin_stats_get_132);
app.get("/api/admin/support", admin_support_get_133);
app.get("/api/admin/support/announcements", admin_support_announcements_get_134);
app.post("/api/admin/support/announcements", admin_support_announcements_post_135);
app.post("/api/admin/support/assign", admin_support_assign_post_136);
app.post("/api/admin/support/bulk", admin_support_bulk_post_137);
app.delete("/api/admin/support/canned", admin_support_canned_delete_138);
app.get("/api/admin/support/canned", admin_support_canned_get_139);
app.post("/api/admin/support/canned", admin_support_canned_post_140);
app.put("/api/admin/support/canned", admin_support_canned_put_141);
app.get("/api/admin/support/complaints", admin_support_complaints_get_142);
app.post("/api/admin/support/complaints", admin_support_complaints_post_143);
app.get("/api/admin/support/contact-forms", admin_support_contact_forms_get_144);
app.post("/api/admin/support/contact-forms", admin_support_contact_forms_post_145);
app.get("/api/admin/support/feedback", admin_support_feedback_get_146);
app.post("/api/admin/support/feedback", admin_support_feedback_post_147);
app.get("/api/admin/support/messages", admin_support_messages_get_148);
app.post("/api/admin/support/messages", admin_support_messages_post_149);
app.post("/api/admin/support/note", admin_support_note_post_150);
app.get("/api/admin/support/notifications", admin_support_notifications_get_151);
app.post("/api/admin/support/notifications", admin_support_notifications_post_152);
app.post("/api/admin/support/priority", admin_support_priority_post_153);
app.post("/api/admin/support/reply", admin_support_reply_post_154);
app.get("/api/admin/support/routing", admin_support_routing_get_155);
app.post("/api/admin/support/routing", admin_support_routing_post_156);
app.get("/api/admin/support/stats", admin_support_stats_get_157);
app.post("/api/admin/support/status", admin_support_status_post_158);
app.get("/api/admin/tickets", admin_tickets_get_159);
app.get("/api/admin/tickets/replies", admin_tickets_replies_get_160);
app.post("/api/admin/tickets/reply", admin_tickets_reply_post_161);
app.get("/api/admin/trading", admin_trading_get_162);
app.get("/api/admin/trading/active-traders", admin_trading_active_traders_get_163);
app.get("/api/admin/trading/fees", admin_trading_fees_get_164);
app.post("/api/admin/trading/fees", admin_trading_fees_post_165);
app.get("/api/admin/trading/freeze", admin_trading_freeze_get_166);
app.post("/api/admin/trading/freeze", admin_trading_freeze_post_167);
app.get("/api/admin/trading/markets", admin_trading_markets_get_168);
app.get("/api/admin/trading/logs", admin_trading_logs_get);
app.put("/api/admin/trading/markets", admin_trading_markets_put_169);
app.post("/api/admin/trading/markets/suspend", admin_trading_markets_suspend_post_170);
app.get("/api/admin/trading/providers", admin_trading_providers_get_171);
app.put("/api/admin/trading/providers", admin_trading_providers_put_172);
app.get("/api/admin/transactions", admin_transactions_get_173);
app.post("/api/admin/transactions/approve", admin_transactions_approve_post_174);
app.post("/api/admin/transactions/create", admin_transactions_create_post_175);
app.post("/api/admin/transactions/edit", admin_transactions_edit_post);
app.post("/api/admin/transactions/freeze", admin_transactions_freeze_post_176);
app.get("/api/admin/transactions/real", admin_transactions_real_get_177);
app.post("/api/admin/transactions/reject", admin_transactions_reject_post_178);
app.get("/api/admin/users", admin_users_get_179);
app.post("/api/admin/users/action", admin_users_action_post_180);
app.post("/api/admin/users/approve", admin_users_approve_post_181);
app.post("/api/admin/users/create", admin_users_create_post_182);
app.post("/api/admin/users/currency", admin_users_currency_post_183);
app.post("/api/admin/users/delete", admin_users_delete_post_184);
app.post("/api/admin/users/edit", admin_users_edit_post_185);
app.post("/api/admin/users/override", admin_users_override_post_186);
app.post("/api/admin/users/reject", admin_users_reject_post_187);
app.post("/api/admin/users/reset-2fa", admin_users_reset_2fa_post_188);
app.post("/api/admin/users/reset-password", admin_users_reset_password_post_189);
app.get("/api/admin/users/:id", admin_users_id_get);
app.get("/api/admin/users/:id/audit", admin_users_id_audit_get_190);
app.get("/api/admin/users/:id/devices", admin_users_id_devices_get_191);
app.get("/api/admin/users/:id/login-history", admin_users_id_login_history_get_192);
app.get("/api/admin/users/:id/security-events", admin_users_id_security_events_get_193);
app.get("/api/admin/wallets", admin_wallets_get_194);
app.get("/api/users/plaid", users_plaid_get);
app.post("/api/users/plaid/link-token", users_plaid_link_token_post);
app.post("/api/users/plaid/exchange", users_plaid_exchange_post);
app.post("/api/users/plaid/disconnect", users_plaid_disconnect_post);
app.patch("/api/admin/wallets", admin_wallets_patch_195);
app.get("/api/admin/website", admin_website_get_196);
app.post("/api/admin/website", admin_website_post_197);
app.post("/api/admin/zoho/exchange", admin_zoho_exchange_post_198);
app.get("/api/admin/zoho/oauth/callback", admin_zoho_oauth_callback_get_199);
app.get("/api/analytics/ab-results", analytics_ab_results_get_200);
app.get("/api/analytics/conversions", analytics_conversions_get_201);
app.post("/api/analytics/event", analytics_event_post_202);
app.get("/api/analytics/summary", analytics_summary_get_203);
app.post("/api/chat", chat_post_204);
app.get("/api/cms/content", cms_content_get_205);
app.get("/api/cms/homepage", cms_homepage_get);
app.get("/api/config/tawk-widget", config_tawk_widget_get_206);
app.post("/api/contact", contact_post_207);
app.get("/api/csrf", csrf_get_208);
app.get("/api/health", health_get_209);
app.get("/api/market/candles", market_candles_get_210);
app.get("/api/market/orderbook", market_orderbook_get_211);
app.get("/api/market/providers", market_providers_get_212);
app.get("/api/market/search", market_search_get_213);
app.get("/api/market/stream", market_stream_get_214);
app.get("/api/market/summary", market_summary_get_215);
app.get("/api/market/ticker", market_ticker_get_216);
app.post("/api/newsletter/send-sequence", newsletter_send_sequence_post_217);
app.post("/api/newsletter/subscribe", newsletter_subscribe_post_218);
app.get("/api/newsletter/subscribers", newsletter_subscribers_get_219);
app.get("/api/newsletter/unsubscribe", newsletter_unsubscribe_get_220);
app.get("/api/og", og_get_221);
app.get("/api/settings/rates", settings_rates_get_222);
app.get("/api/settings/social", settings_social_get_223);
app.get("/api/settings/website", settings_website_get);
app.post("/api/users/2fa/setup", users_2fa_setup_post_225);
app.post("/api/users/2fa/verify", users_2fa_verify_post_226);
app.post("/api/users/avatar", users_avatar_post_227);
app.get("/api/users/balance", users_balance_get_228);
app.get("/api/users/beneficiaries", users_beneficiaries_get_229);
app.post("/api/users/beneficiaries/add", users_beneficiaries_add_post_230);
app.post("/api/users/beneficiaries/delete", users_beneficiaries_delete_post_231);
app.post("/api/users/beneficiaries/update", users_beneficiaries_update_post_232);
app.get("/api/users/accounts", users_accounts_get);
app.get("/api/users/cards", users_cards_get_233);
app.post("/api/users/cards/delete", users_cards_delete_post_234);
app.post("/api/users/cards/freeze", users_cards_freeze_post_235);
app.post("/api/users/cards/generate", users_cards_generate_post_236);
app.post("/api/users/cards/request", users_cards_request_post_237);
app.post("/api/users/deposit", users_deposit_post_238);
app.get("/api/users/devices", users_devices_get_239);
app.post("/api/users/devices/revoke", users_devices_revoke_post_240);
app.post("/api/users/kyc-document", users_kyc_document_post_241);
app.get("/api/users/onboarding", users_onboarding_get);
app.post("/api/users/onboarding/evidence", users_onboarding_evidence_post);
app.post("/api/users/onboarding/submit", users_onboarding_submit_post);
app.post("/api/users/login", users_login_post_242);
app.get("/api/users/login-history", users_login_history_get_243);
app.post("/api/users/logout", users_logout_post_244);
app.patch("/api/users/me", users_me_patch_245);
app.get("/api/users/notifications", users_notifications_get_246);
app.post("/api/users/notifications/delete", users_notifications_delete_post_247);
app.get("/api/users/notifications/preferences", users_notifications_preferences_get_248);
app.post("/api/users/notifications/preferences", users_notifications_preferences_post_249);
app.post("/api/users/notifications/read", users_notifications_read_post_250);
app.post("/api/users/password-reset", users_password_reset_post_251);
app.post("/api/users/password-reset/confirm", users_password_reset_confirm_post_252);
app.put("/api/users/profile", users_profile_put_253);
app.post("/api/users/register", users_register_post_254);
app.get("/api/users/security/events", users_security_events_get_255);
app.get("/api/users/security/sessions", users_security_sessions_get_256);
app.post("/api/users/security/sessions/revoke", users_security_sessions_revoke_post_257);
app.post("/api/users/security/sessions/revoke-all", users_security_sessions_revoke_all_post_258);
app.get("/api/users/session", users_session_get_258);
app.get("/api/users/support", users_support_get_259);
app.post("/api/users/support", users_support_post_260);
app.post("/api/users/swap", users_swap_post_261);
app.get("/api/users/trading/alerts", users_trading_alerts_get_262);
app.post("/api/users/trading/alerts", users_trading_alerts_post_263);
app.get("/api/users/trading/analytics", users_trading_analytics_get_264);
app.get("/api/users/trading/history", users_trading_history_get_265);
app.get("/api/users/trading/market-data", users_trading_market_data_get_266);
app.get("/api/users/trading/orders", users_trading_orders_get_267);
app.post("/api/users/trading/orders", users_trading_orders_post_268);
app.post("/api/users/trading/orders/cancel", users_trading_orders_cancel_post_269);
app.get("/api/users/trading/portfolio", users_trading_portfolio_get_270);
app.get("/api/users/trading/summary", users_trading_summary_get_271);
app.get("/api/users/trading/watchlist", users_trading_watchlist_get_272);
app.post("/api/users/trading/watchlist", users_trading_watchlist_post_273);
app.get("/api/users/transactions", users_transactions_get_274);
app.get("/api/users/transactions/receipt", users_transactions_receipt_get);
app.get("/api/users/disputes", users_disputes_get);
  app.post("/api/users/disputes", rateLimitMiddleware(
  (req) => `customer-dispute:${req.customerUser?.id ?? req.ip ?? 'unknown'}`,
  { windowMs: 60 * 60_000, max: 10 },
  'Too many dispute submissions. Please try again later.',
  ), users_disputes_post);
  app.get("/api/users/goals", users_goals_get);
  app.post("/api/users/goals", rateLimitMiddleware(
    (req) => `customer-goals:${req.customerUser?.id ?? req.ip ?? 'unknown'}`,
    { windowMs: 60 * 60_000, max: 60 },
    'Too many goal changes. Please try again later.',
  ), users_goals_post);
  app.get("/api/users/bills", users_bills_get);
  app.post("/api/users/bills", rateLimitMiddleware(
    (req) => `customer-bills:${req.customerUser?.id ?? req.ip ?? 'unknown'}`,
    { windowMs: 60 * 60_000, max: 60 },
    'Too many bill schedule changes. Please try again later.',
  ), users_bills_post);
  app.get("/api/users/rewards", users_rewards_get);
  app.get("/api/users/search", rateLimitMiddleware(
    (req) => `customer-search:${req.customerUser?.id ?? req.ip ?? 'unknown'}`,
    { windowMs: 60_000, max: 90 },
    'Too many searches. Please try again shortly.',
  ), users_search_get);
  app.get("/api/admin/search", rateLimitMiddleware(
    (req) => `admin-search:${req.adminSession?.adminId ?? req.ip ?? 'unknown'}`,
    { windowMs: 60_000, max: 120 },
    'Too many searches. Please try again shortly.',
  ), admin_search_get);
app.post("/api/users/transfer", users_transfer_post_275);
app.get("/api/users/transfers", users_transfers_get_276);
app.post("/api/users/transfers", users_transfers_post_277);
app.get("/api/users/verify-email", users_verify_email_get_278);
app.get("/api/users/wallet-overview", users_wallet_overview_get_279);
app.get("/api/users/features", users_features_get);
app.post("/api/users/withdraw", users_withdraw_post_280);
app.get("/api/zoho/callback", zoho_callback_get_281);
app.get("/api/zoho/connect", zoho_connect_get_282);
app.get("/api/zoho/status", zoho_status_get_283);
// </api-registrations>

// Error middleware must be registered AFTER the routes it protects; Express
// only passes errors to middleware defined later in the stack.
app.use("/api", (err: unknown, req: Request, res: Response, _next: NextFunction) => {
	// Always respond JSON on /api so clients parsing response.json() don't
	// receive Express's default HTML error page for non-Error throws.
	const isProd = process.env.NODE_ENV === 'production';
	// Avoid using req.method as a dynamic lookup key (scanner: object injection).
	// Log the URL only; method is not needed for error diagnosis.
	console.error("ssr.api.error", {
		url: redactHttpLogUrl(req.url),
		...safeApiErrorDetails(err),
	});
	// Never leak stack traces or internal details to clients in production
	if (!res.headersSent) {
		res.status(500).json({
			error: "Internal server error",
			...(isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
		});
	}
});

function baseUrl(req: Request): string {
	const env = process.env.PUBLIC_URL || process.env.SITE_URL;
	if (env) return env.endsWith('/') ? env.replace(/\/+$/, '') : env;
	return `${req.protocol}://${req.hostname}`;
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

app.get("/robots.txt", (req, res) => {
	const base = baseUrl(req);
	const body = [
		"User-agent: *",
		"Allow: /",
		"Disallow: /admin",
		"Disallow: /admin/",
		"Disallow: /api/admin/",
		"Disallow: /dashboard",
		"Disallow: /wallet",
		"Disallow: /transfers",
		"Disallow: /kyc",
		"Disallow: /analytics",
		"Disallow: /newsletter",
		"Disallow: /login",
		"Disallow: /register",
		"Disallow: /forgot-password",
		"Disallow: /reset-password",
		"Disallow: /sponsor-review",
		"Disallow: /api/users/",
		"",
		`Sitemap: ${base}/sitemap.xml`,
		"",
	].join("\n");
	res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(body);
});

app.get("/sitemap.xml", (req, res) => {
	const base = baseUrl(req);

	// Routes that must NEVER appear in the public sitemap regardless of what
	// seo-routes.ts contains. The auto-sync tool mirrors all static routes from
	// routes.tsx into seo-routes.ts — this server-side filter is the authoritative
	// gate that strips private/authenticated paths before the XML is served.
	const PRIVATE_PREFIXES = [
		'/admin', '/dashboard', '/kyc',
		'/wallet', '/transfers',
		'/login', '/register', '/forgot-password', '/reset-password',
		'/sponsor-review',
		'/analytics', '/newsletter',
	];

	const urls = seoRoutes
		.filter((r) => typeof r.path === "string" && r.path.startsWith("/"))
		.filter((r) => !PRIVATE_PREFIXES.some(prefix => r.path === prefix || r.path.startsWith(prefix + '/')))
		.map((r) => {
			const loc = `${base}${r.path}`;
			const parts = [`    <loc>${escapeXml(loc)}</loc>`];
			if (r.lastmod) parts.push(`    <lastmod>${escapeXml(r.lastmod)}</lastmod>`);
			if (r.changefreq) parts.push(`    <changefreq>${r.changefreq}</changefreq>`);
			if (r.priority !== undefined)
				parts.push(`    <priority>${r.priority.toFixed(1)}</priority>`);
			return `  <url>\n${parts.join("\n")}\n  </url>`;
		})
		.join("\n");
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
	res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(body);
});

// The bundled standalone server owns SSR, static files, WebSockets and
// long-lived workers. Vercel imports the Express app as a request function;
// those container lifecycle responsibilities must not start there.
const isVercelRuntime = process.env.VERCEL === '1';
// Start the long-lived HTTP/WebSocket server only when this module is the
// process entrypoint. This standard ESM main-module check survives Vite's SSR
// tree-shaking, unlike `import.meta.env.PROD`, and remains false when Vite's
// development middleware, tests, or a serverless adapter import the app.
const isStandaloneEntrypoint = Boolean(
	process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url),
);

if (isStandaloneEntrypoint && !isVercelRuntime) {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const clientDir = join(__dirname, "client");

	app.use(createMediaAssetsMiddleware(() => process.cwd()));

	app.use(
		express.static(clientDir, {
			index: false,
			setHeaders(res, filePath) {
				res.set(
					"Cache-Control",
					filePath.includes("/assets/")
						? "public, max-age=31536000, immutable"
						: "no-cache",
				);
			},
		}),
	);

	app.use((_req, res, next) => {
		res.set("Cache-Control", "no-cache");
		next();
	});

	let template: string;
	try {
		template = readFileSync(join(clientDir, "index.html"), "utf-8");
	} catch (err) {
		console.error("ssr.template.load-failed", {
			path: join(clientDir, "index.html"),
			error: err instanceof Error ? err.message : String(err),
		});
		process.exit(1);
	}
	if (!template.includes("<!--app-head-->") || !template.includes("<!--app-html-->")) {
		// Fail fast at boot, same as a template load failure above: without
		// markers, every .replace() call on the render path is a no-op and we
		// would serve a shell with no <head> content and no rendered body on
		// every request. Preferring process.exit over a degraded mode ensures
		// an operator notices and fixes the build rather than serving broken
		// SEO-invisible pages indefinitely.
		console.error("ssr.template.markers-missing", {
			hasHead: template.includes("<!--app-head-->"),
			hasHtml: template.includes("<!--app-html-->"),
		});
		process.exit(1);
	}
	const fallbackShell = template
		.replace("<!--app-head-->", "")
		.replace("<!--app-html-->", "");

	// ── Global JSON error handler ──────────────────────────────────────────
	// Catches any unhandled errors thrown in API route handlers and returns
	// a structured JSON response instead of an HTML error page.
	// This prevents "Unexpected token <" JSON.parse failures on the client.
	app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
		const message = err instanceof Error ? err.message : String(err);
		const stack   = err instanceof Error ? err.stack : undefined;
		console.error(JSON.stringify({ event: 'api.unhandled_error', path: req.path, error: message, stack }));
		if (res.headersSent) return;
		res.status(500).json(process.env.NODE_ENV === 'production'
			? { error: 'Internal server error' }
			: { error: 'Internal server error', message });
	});

	// Resolve the SSR module once into a stable render function. A failed
	// load is unrecoverable at runtime - exiting lets the container
	// scheduler restart with a clean slate rather than leaving the server
	// to serve silent 503s indefinitely against a single startup log.
	type RenderResult = {
		html: string;
		head: string;
		status: number;
		redirect?: string;
	};
	let renderFn: ((url: string) => Promise<RenderResult>) | null = null;
	const SSR_MODULE_LOAD_TIMEOUT_MS = 30_000;
	const loadTimeout = setTimeout(() => {
		if (renderFn !== null) return;
		console.error("ssr.module.load-timeout", {
			timeoutMs: SSR_MODULE_LOAD_TIMEOUT_MS,
		});
		process.exit(1);
	}, SSR_MODULE_LOAD_TIMEOUT_MS);
	loadTimeout.unref();
	import("../entry-server").then(
		(mod) => {
			clearTimeout(loadTimeout);
			renderFn = mod.render;
		},
		(err) => {
			clearTimeout(loadTimeout);
			console.error("ssr.module.load-failed", {
				error: err instanceof Error ? err.stack : String(err),
			});
			process.exit(1);
		},
	);

	// ── Early Hints (103) for HTML page requests ──────────────────────────────
	// Sends Link preload headers for critical assets before the full response.
	// Only sent for HTML page requests (not API, not static assets).
	// Cloudflare and modern browsers use these to start fetching critical
	// resources while the server is still rendering the page.
	const EARLY_HINT_LINKS = [
		'</assets/react-vendor.js>; rel=preload; as=script',
		'</assets/router.js>; rel=preload; as=script',
		'</assets/index.css>; rel=preload; as=style',
		'<https://fonts.googleapis.com>; rel=preconnect',
		'<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
	].join(', ');

	app.get("/{*path}", async (req, res, next) => {
		if (req.path.startsWith("/api")) return next();
		if (extname(req.path)) return next();

		// Send 103 Early Hints for HTML page requests (supported by HTTP/2+)
		// Only send if the client supports it (HTTP/2 or HTTP/3)
		// res.writeEarlyHints is available in Node 18.11+ and Express 5
		if (typeof (res as unknown as { writeEarlyHints?: (hints: Record<string, string | string[]>) => void }).writeEarlyHints === 'function') {
			try {
				(res as unknown as { writeEarlyHints: (hints: Record<string, string | string[]>) => void })
					.writeEarlyHints({ 'Link': EARLY_HINT_LINKS });
			} catch { /* ignore — not all clients support 103 */ }
		}
		const sendFallback = () =>
			res
				.status(503)
				.set("Content-Type", "text/html; charset=utf-8")
				.set("Cache-Control", "no-store")
				.send(fallbackShell);
		if (renderFn === null) {
			// Module not yet resolved; fall back without logging to avoid startup
			// noise before the first render is even possible. A terminal load
			// failure (import reject or 30s timeout) process.exit(1)s from the
			// loader above, so this branch is only the brief warmup window.
			return sendFallback();
		}
		try {
			const result = await renderFn(req.url);
			if (result.redirect) {
				// Redirect thrown from a loader/action surfaces as a Response.
				// Forward it so the browser actually navigates to the new URL
				// instead of seeing an empty shell with a stale status.
				res.redirect(result.status, result.redirect);
				return;
			}
			if (!result.html) {
				// A non-redirect Response was thrown from a loader (e.g.
				// `throw new Response(null, { status: 404 })`). renderToString
				// produced no markup, so we have a real status but no body.
				// Log so the case is observable in ops dashboards, and mark
				// no-store so CDNs don't cache an empty page as a valid hit.
				// User-visible 404 / error pages should come from a route
				// errorElement, not from this fallback path.
				console.error("ssr.render.error-response", {
					url: req.url,
					status: result.status,
				});
				res
					.status(result.status)
					.set("Content-Type", "text/html; charset=utf-8")
					.set("Cache-Control", "no-store")
					.send(fallbackShell);
				return;
			}
			// Inject server-side-only meta tags (values from secrets that must
			// not be hard-coded in source). These are appended to the Helmet
			// head so they appear in the rendered HTML without being in the
			// React component tree or the source repository.
			const gscToken = getSecret("GOOGLE_SITE_VERIFICATION");
			const extraHead = gscToken
				? `<meta name="google-site-verification" content="${gscToken}" />`
				: "";

			// Function replacements disable String.replace's $-special sequences
			// ($&, $', $`, $$) so user-authored titles / JSON-LD like
			// "Save $& today" insert literally instead of being interpolated.
			const out = template
				.replace("<!--app-head-->", () => result.head + (extraHead ? `\n${extraHead}` : ""))
				.replace("<!--app-html-->", () => result.html);
			res
				.status(result.status)
				.set("Content-Type", "text/html; charset=utf-8")
				.set("Cache-Control", "no-cache")
				.send(out);
		} catch (err) {
			// 503 surfaces the failure in CDN/monitoring without caching a broken
			// page as success. console.error (not warn) puts it at the right log
			// level for the observability pipeline to alert on.
			console.error("ssr.render.failed", {
				url: req.url,
				// Log the full stack — React's renderToString annotates it with
				// the failing component's call tree, which the message alone
				// discards.
				error: err instanceof Error ? err.stack : String(err),
			});
			sendFallback();
		}
	});

	let shuttingDown = false;
	const shutdown = async (signal: string) => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log(`Got ${signal}, draining HTTP and WebSocket connections...`);
		const forcedExit = setTimeout(() => {
			console.error('ssr.shutdown.timeout', { signal });
			process.exit(1);
		}, 25_000);
		forcedExit.unref();

		if (wsBroadcastTimer) clearInterval(wsBroadcastTimer);
		if (wsCleanupTimer) clearInterval(wsCleanupTimer);
		for (const client of wss.clients) {
			try { client.close(1001, 'Service restarting'); } catch { /* already closed */ }
		}

		await new Promise<void>((resolve) => {
			httpServer.close((error) => {
				if (error) console.error('ssr.shutdown.http-close-failed', { error: error.message });
				resolve();
			});
		});

		try {
			await closeConnection();
			console.log('Database connections closed');
		} catch (error: unknown) {
			console.error('ssr.shutdown.db-close-failed', {
				error: error instanceof Error ? error.message : String(error),
			});
		}
		clearTimeout(forcedExit);
		process.exit(0);
	};

	(["SIGTERM", "SIGINT"] as const).forEach((signal) => {
		process.once(signal, () => {
			void shutdown(signal);
		});
	});

	const rawPort = process.env.PORT || "3000";
	const port = parseInt(rawPort, 10);
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		// parseInt("abc") returns NaN; passing that to app.listen throws
		// synchronously before the server.on("error") handler below can catch
		// it. Fail fast with an actionable log rather than a cryptic crash.
		console.error("ssr.server.invalid-port", { rawPort });
		process.exit(1);
	}

	// ── Process-level safety nets ──────────────────────────────────────────
	// Log unhandled promise rejections instead of crashing silently.
	// In Node 15+ unhandled rejections crash the process by default — we
	// log and let the container scheduler decide whether to restart.
	process.on('unhandledRejection', (reason, promise) => {
		console.error('ssr.process.unhandledRejection', {
			reason: reason instanceof Error ? reason.stack : String(reason),
			promise: String(promise),
		});
	});

	// Log uncaught exceptions and exit — the container will restart.
	// Attempting to continue after an uncaught exception is unsafe.
	process.on('uncaughtException', (err) => {
		console.error('ssr.process.uncaughtException', {
			error: err.stack ?? err.message,
		});
		process.exit(1);
	});

	const host = process.env.HOST || "0.0.0.0";

	// ── HTTP server wrapping Express ──────────────────────────────────────────
	const httpServer = createServer(app);

	// ── WebSocket server for live market data ─────────────────────────────────
	// Path: /ws/market
	// Client → server: { type:"subscribe", symbols:["BTCUSDT",...] }
	//                  { type:"unsubscribe", symbols:[...] }
	//                  { type:"ping" }
	// Server → client: { type:"ticker", data: TickerData[], ts: number }
	//                  { type:"pong" }
	const wss = new WebSocketServer({ noServer: true });
	const wsSubscriptions = new Map<WebSocket, Set<string>>();
	/** Track last ping time per client to detect dead connections */
	const wsLastSeen = new Map<WebSocket, number>();
	let wsBroadcastTimer: ReturnType<typeof setInterval> | null = null;
	let wsCleanupTimer: ReturnType<typeof setInterval> | null = null;
	/** Per-IP upgrade rate limiting counters */
	let wsUpgradeCounters: Map<string, { count: number; resetAt: number }> | null = null;

	function startWsBroadcast() {
		if (wsBroadcastTimer) return;
		wsBroadcastTimer = setInterval(async () => {
			if (wss.clients.size === 0) return;
			const allSymbols = new Set<string>();
			wsSubscriptions.forEach(syms => syms.forEach(s => allSymbols.add(s)));
			if (allSymbols.size === 0) return;
			try {
				const tickers = await marketRegistry.getTicker([...allSymbols], 'crypto');
				wss.clients.forEach(client => {
					if (client.readyState !== 1 /* OPEN */) return;
					const subs = wsSubscriptions.get(client);
					if (!subs || subs.size === 0) return;
					// Per-symbol fan-out: only send symbols this client subscribed to
					const filtered = (tickers as Array<{ symbol: string }>).filter(t => subs.has(t.symbol));
					if (filtered.length === 0) return;
					try { client.send(JSON.stringify({ type: 'ticker', data: filtered, ts: Date.now() })); } catch { /* ignore */ }
				});
			} catch { /* market fetch failed — skip tick */ }
		}, 3_000);

		// Stale-client cleanup: terminate clients that haven't pinged in 90s
		wsCleanupTimer = setInterval(() => {
			const now = Date.now();
			wss.clients.forEach(client => {
				const last = wsLastSeen.get(client) ?? now;
				if (now - last > 90_000) {
					wsSubscriptions.delete(client);
					wsLastSeen.delete(client);
					try { client.terminate(); } catch { /* ignore */ }
				}
			});
		}, 30_000);
	}

	wss.on('connection', (ws: WebSocket) => {
		// Default subscriptions for every new connection
		wsSubscriptions.set(ws, new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']));
		wsLastSeen.set(ws, Date.now());

		ws.on('message', (raw: Buffer | string) => {
			wsLastSeen.set(ws, Date.now()); // any message counts as alive
			try {
				const msg = JSON.parse(raw.toString()) as { type: string; symbols?: string[] };
				if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
				if (msg.type === 'subscribe' && Array.isArray(msg.symbols)) {
					const subs = wsSubscriptions.get(ws) ?? new Set<string>();
					msg.symbols.forEach(s => subs.add(String(s).toUpperCase()));
					wsSubscriptions.set(ws, subs);
				}
				if (msg.type === 'unsubscribe' && Array.isArray(msg.symbols)) {
					const subs = wsSubscriptions.get(ws);
					if (subs) msg.symbols.forEach(s => subs.delete(String(s).toUpperCase()));
				}
			} catch { /* malformed JSON */ }
		});
		ws.on('close', () => { wsSubscriptions.delete(ws); wsLastSeen.delete(ws); });
		ws.on('error', () => { wsSubscriptions.delete(ws); wsLastSeen.delete(ws); });
	});

	// Upgrade HTTP → WS only for /ws/market
	// Security: validate Origin header to prevent cross-origin WebSocket abuse.
	// In production, only allow connections from the same origin (citygate.capital)
	// or from localhost/127.0.0.1 (for health checks and internal tooling).
	// In development, allow all origins so local dev works without extra config.
	httpServer.on('upgrade', (req, socket, head) => {
		if (req.url !== '/ws/market') {
			socket.destroy();
			return;
		}

		// Origin validation — only in production
		if (process.env.NODE_ENV === 'production') {
			const origin = req.headers.origin ?? '';
			const allowedOrigins = [
				'https://citygate.capital',
				'https://www.citygate.capital',
				// Allow the configured APP_URL if set
				...(process.env.APP_URL ? [process.env.APP_URL.endsWith('/') ? process.env.APP_URL.slice(0, -1) : process.env.APP_URL] : []),
			];
			const isAllowed =
				!origin || // no origin header = same-origin request (curl, server-to-server)
				allowedOrigins.some(o => origin === o) ||
				// Allow localhost/127.0.0.1 for dev tooling — use string checks to avoid ReDoS
				origin === 'http://localhost' || origin === 'https://localhost' ||
				origin === 'http://127.0.0.1' || origin === 'https://127.0.0.1' ||
				origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:') ||
				origin.startsWith('http://127.0.0.1:') || origin.startsWith('https://127.0.0.1:');

			if (!isAllowed) {
				console.warn(JSON.stringify({
					event: 'ws.upgrade.rejected',
					reason: 'origin_not_allowed',
					origin,
					ip: req.socket.remoteAddress,
				}));
				socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
				socket.destroy();
				return;
			}
		}

		// Rate-limit WebSocket upgrades: max 30 new connections per IP per minute
		const clientIp = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
			?? req.socket.remoteAddress
			?? 'unknown';
		const wsRateKey = `ws:upgrade:${clientIp}`;
		const wsRateWindow = 60_000;
		const wsRateMax = 30;
		// Simple in-memory counter (reuses the existing rateLimiter store via checkRateLimit)
		// We import checkRateLimit at the top of the file already via rateLimitMiddleware
		// Use a lightweight inline counter here to avoid circular dependency issues
		if (!wsUpgradeCounters) wsUpgradeCounters = new Map();
		const now = Date.now();
		const counter = wsUpgradeCounters.get(wsRateKey);
		if (!counter || counter.resetAt < now) {
			wsUpgradeCounters.set(wsRateKey, { count: 1, resetAt: now + wsRateWindow });
		} else {
			counter.count++;
			if (counter.count > wsRateMax) {
				console.warn(JSON.stringify({
					event: 'ws.upgrade.rate_limited',
					ip: clientIp,
					count: counter.count,
				}));
				socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
				socket.destroy();
				return;
			}
		}

		wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
	});

	// The E2E server is a separate process from its fixture builder. Seed the
	// reset-token digest inside this process so the password-reset handler and
	// fixture share the same in-memory store. These variables are accepted only
	// in the explicitly isolated E2E runtime and are never logged.
	const seedE2EResetToken = async () => {
		if (process.env.E2E_TEST_MODE !== '1') return;
		const resetUserId = process.env.E2E_RESET_USER_ID;
		const resetToken = process.env.E2E_RESET_TOKEN;
		const resetExpiresAt = process.env.E2E_RESET_EXPIRES_AT;
		if (resetUserId && resetToken && resetExpiresAt) {
			const expiresAt = new Date(resetExpiresAt);
			if (!Number.isNaN(expiresAt.getTime())) {
				await issueCustomerResetToken(resetUserId, resetToken, expiresAt);
			}
		}
	};

	const startStandaloneServer = () => httpServer.listen(port, host, () => {
		console.log(`Server listening on http://${host}:${port}`);
		console.log(`WebSocket market feed on ws://${host}:${port}/ws/market`);

		// ── Startup: log resolved credential state ──────────────────────────
		logStartupCredentialState();

		// ── Startup: migrate plaintext card PANs to AES-256-GCM encrypted ──
		try { migrateCardsToEncrypted(); } catch (e) {
			console.warn('cardStore.migration.skipped', String(e));
		}

		// ── Startup: load config from DB into in-memory cache ──────────────
		Promise.all([
			loadConfigFromDb().catch(e => console.warn('configStore.load.skipped', String(e))),
			syncLegacySupportConversations().catch(e => console.warn('supportStore.migration.skipped', e instanceof Error ? e.name : 'UnknownError')),
			loadSmtpConfigFromDb().catch(e => console.warn('smtpConfigStore.load.skipped', String(e))),
			loadEmailBrandingFromDb().catch(e => console.warn('emailBranding.load.skipped', String(e))),
			loadEmailTemplatesFromDb().catch(e => console.warn('emailTemplates.load.skipped', String(e))),
		]).then(() => {
			// ── Start email queue retry worker ──────────────────────────────────
			startEmailQueueWorker(smtpSendEmail);
		});

		// ── Initialise market data providers ───────────────────────────────
		initMarketProviders();
		startOperationalBackupWorker();

		// ── Start WebSocket broadcast loop ──────────────────────────────────
		startWsBroadcast();
	});

	void seedE2EResetToken()
		.then(startStandaloneServer)
		.catch((error) => {
			console.error('e2e.reset-fixture.seed-failed', {
				error: error instanceof Error ? error.name : 'UnknownError',
			});
			process.exit(1);
		});

	httpServer.on("error", (err: NodeJS.ErrnoException) => {
		console.error("ssr.server.listen-failed", {
			port,
			host,
			code: err.code,
			error: err.message,
		});
		process.exit(1);
	});
}

export default app;
