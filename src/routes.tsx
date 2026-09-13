import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate, useLocation } from 'react-router-dom';
import { AdminOnly, CustomerOnly, FeatureOnly } from './components/routeGuards';

/** Redirect that carries the current query string across (deep links like /admin/kyc?search=…). */
function PreserveSearchRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export type Path = string;
export type Params = Record<string, string | undefined>;

const HomePage = lazy(() => import('./pages/index'));
const OurStoryPage = lazy(() => import('./pages/our-story'));
const DigitalBankingPage = lazy(() => import('./pages/digital-banking'));
const WalletPage = lazy(() => import('./pages/wallet'));
const AccountsPage = lazy(() => import('./pages/accounts'));
const TransfersPage = lazy(() => import('./pages/transfers'));
const SupportPage = lazy(() => import('./pages/support'));
const ContactPage = lazy(() => import('./pages/contact'));
const AnalyticsPage = lazy(() => import('./pages/analytics'));
const NewsletterPage = lazy(() => import('./pages/newsletter'));
const PrivacyPolicyPage = lazy(() => import('./pages/privacy-policy'));
const TermsOfServicePage = lazy(() => import('./pages/terms-of-service'));
const CookiePolicyPage = lazy(() => import('./pages/cookie-policy'));
const CompliancePage = lazy(() => import('./pages/compliance'));
const NotFoundPage = lazy(() => import('./pages/_404'));
const SponsorReviewPage = lazy(() => import('./pages/sponsor-review'));

// Customer auth pages
const LoginPage         = lazy(() => import('./pages/login'));
const ForgotPasswordPage = lazy(() => import('./pages/forgot-password'));
const ResetPasswordPage  = lazy(() => import('./pages/reset-password'));
const PlaidOAuthPage     = lazy(() => import('./pages/plaid-oauth'));
const DashboardPage     = lazy(() => import('./pages/dashboard'));
const DashboardCards    = lazy(() => import('./pages/dashboard/cards'));
const DashboardAnalytics = lazy(() => import('./pages/dashboard/analytics'));
const DashboardSecurity  = lazy(() => import('./pages/dashboard/security'));
const DashboardWallets   = lazy(() => import('./pages/dashboard/wallets'));
const DashboardAccounts  = lazy(() => import('./pages/dashboard/accounts'));
const DashboardTransfers = lazy(() => import('./pages/dashboard/transfers'));
const DashboardDeposits  = lazy(() => import('./pages/dashboard/deposits'));
const DashboardNotifications = lazy(() => import('./pages/dashboard/notifications'));
const DashboardProfile   = lazy(() => import('./pages/dashboard/profile'));
const DashboardSettings  = lazy(() => import('./pages/dashboard/settings'));
const DashboardStatements    = lazy(() => import('./pages/dashboard/statements'));
const DashboardTransactions  = lazy(() => import('./pages/dashboard/transactions'));
const DashboardDevices       = lazy(() => import('./pages/dashboard/devices'));
const DashboardBeneficiaries = lazy(() => import('./pages/dashboard/beneficiaries'));
const DashboardSupport       = lazy(() => import('./pages/dashboard/support'));
const DashboardDisputes      = lazy(() => import('./pages/dashboard/disputes'));
const DashboardGoals         = lazy(() => import('./pages/dashboard/goals'));
const DashboardBills         = lazy(() => import('./pages/dashboard/bills'));
const DashboardRewards       = lazy(() => import('./pages/dashboard/rewards'));
const DashboardSearch        = lazy(() => import('./pages/dashboard/search'));
const DashboardRates         = lazy(() => import('./pages/dashboard/rates'));
const DashboardTrading       = lazy(() => import('./pages/dashboard/trading'));
const DashboardTradingMarkets   = lazy(() => import('./pages/dashboard/trading/markets'));
const DashboardTradingOrders    = lazy(() => import('./pages/dashboard/trading/orders'));
const DashboardTradingChart     = lazy(() => import('./pages/dashboard/trading/chart'));
const DashboardTradingWatchlist = lazy(() => import('./pages/dashboard/trading/watchlist'));
const DashboardTradingAnalytics = lazy(() => import('./pages/dashboard/trading/analytics'));
const DashboardTradingSpot      = lazy(() => import('./pages/dashboard/trading/spot'));
const DashboardTradingTrades    = lazy(() => import('./pages/dashboard/trading/trades'));

// Admin pages
const AdminLoginPage            = lazy(() => import('./pages/admin/login'));
const AdminForgotPasswordPage   = lazy(() => import('./pages/admin/forgot-password'));
const AdminResetPasswordPage    = lazy(() => import('./pages/admin/reset-password'));
const AdminDashboard       = lazy(() => import('./pages/admin/index'));
const AdminUsers           = lazy(() => import('./pages/admin/users'));
const AdminCustomerRelationships = lazy(() => import('./pages/admin/customer-relationships'));
const AdminCards           = lazy(() => import('./pages/admin/cards'));
const AdminTransactions    = lazy(() => import('./pages/admin/transactions'));
const AdminCrypto          = lazy(() => import('./pages/admin/crypto'));
const AdminCustomerAccounts = lazy(() => import('./pages/admin/customer-accounts'));
const AdminSupport         = lazy(() => import('./pages/admin/support'));
const AdminCMS             = lazy(() => import('./pages/admin/cms'));
const AdminSecurity        = lazy(() => import('./pages/admin/security'));
const AdminNewsletter      = lazy(() => import('./pages/admin/newsletter'));
const AdminContacts        = lazy(() => import('./pages/admin/contacts'));
const AdminOperations      = lazy(() => import('./pages/admin/operations'));
const AdminSmtp            = lazy(() => import('./pages/admin/smtp'));
const AdminZohoSetup       = lazy(() => import('./pages/admin/zoho-setup'));
const AdminSocial          = lazy(() => import('./pages/admin/social'));
const AdminChatbot         = lazy(() => import('./pages/admin/chatbot'));
const AdminLinks           = lazy(() => import('./pages/admin/links'));
const AdminWebsite         = lazy(() => import('./pages/admin/website'));
const AdminRates           = lazy(() => import('./pages/admin/rates'));
const AdminOnboarding      = lazy(() => import('./pages/admin/onboarding'));
const AdminSponsorReadiness = lazy(() => import('./pages/admin/sponsor-readiness'));
const AdminReadiness       = lazy(() => import('./pages/admin/readiness'));
const AdminReconciliation = lazy(() => import('./pages/admin/reconciliation'));
const AdminDisputes = lazy(() => import('./pages/admin/disputes'));
const AdminNotifications   = lazy(() => import('./pages/admin/notifications'));
const AdminSystem          = lazy(() => import('./pages/admin/system'));
const AdminEmailCenter     = lazy(() => import('./pages/admin/email'));
const AdminAudit           = lazy(() => import('./pages/admin/audit'));
const AdminReports         = lazy(() => import('./pages/admin/reports'));
const AdminCompliance      = lazy(() => import('./pages/admin/compliance'));
const AdminMedia           = lazy(() => import('./pages/admin/media'));
const AdminConfig          = lazy(() => import('./pages/admin/config'));
const AdminFeatures        = lazy(() => import('./pages/admin/features'));
const AdminApplications    = lazy(() => import('./pages/admin/applications'));
const RegisterHomePage     = lazy(() => import('./pages/register/index'));
const RegisterPersonal     = lazy(() => import('./pages/register/personal'));
const RegisterSavings      = lazy(() => import('./pages/register/savings'));
const RegisterBusiness     = lazy(() => import('./pages/register/business'));
const RegisterMultiCurrency = lazy(() => import('./pages/register/multi-currency'));
const RegisterWealth       = lazy(() => import('./pages/register/wealth'));
const ApplicationStatus    = lazy(() => import('./pages/application-status'));
const AdminFinancialSandbox = lazy(() => import('./pages/admin/financial-sandbox'));
const AdminIntegrations    = lazy(() => import('./pages/admin/integrations'));
const AdminTrading         = lazy(() => import('./pages/admin/trading'));
const AdminAdministrators  = lazy(() => import('./pages/admin/administrators'));
const AdminDeployments     = lazy(() => import('./pages/admin/deployments'));
const AdminDatabase        = lazy(() => import('./pages/admin/database'));
const OnboardingPage       = lazy(() => import('./pages/onboarding'));

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/demo', element: <Navigate to="/" replace /> },
  { path: '/about', element: <OurStoryPage /> },
  { path: '/our-story', element: <Navigate to="/about" replace /> },
  { path: '/digital-banking', element: <DigitalBankingPage /> },
  { path: '/demo/digital-banking', element: <Navigate to="/digital-banking" replace /> },
  // /wallet and /transfers contain account data — require customer auth
  { path: '/wallet',    element: <CustomerOnly><WalletPage /></CustomerOnly> },
  { path: '/accounts',  element: <AccountsPage /> },
  { path: '/demo/accounts',  element: <Navigate to="/accounts" replace /> },
  { path: '/transfers', element: <CustomerOnly><TransfersPage /></CustomerOnly> },
  { path: '/support', element: <SupportPage /> },
  { path: '/demo/support', element: <Navigate to="/support" replace /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '/privacy-policy', element: <PrivacyPolicyPage /> },
  { path: '/terms-of-service', element: <TermsOfServicePage /> },
  { path: '/cookie-policy', element: <CookiePolicyPage /> },
  { path: '/legal/privacy', element: <PrivacyPolicyPage /> },
  { path: '/legal/terms', element: <TermsOfServicePage /> },
  { path: '/legal/cookies', element: <CookiePolicyPage /> },
  { path: '/compliance', element: <CompliancePage /> },
  { path: '/sponsor-review', element: <SponsorReviewPage /> },
  { path: '/analytics', element: <AdminOnly><AnalyticsPage /></AdminOnly> },
  { path: '/newsletter', element: <AdminOnly><NewsletterPage /></AdminOnly> },
  // Customer auth routes (no RootLayout — these pages manage their own chrome)
  { path: '/login',           element: <LoginPage /> },
  { path: '/register',         element: <FeatureOnly feature="registration"><RegisterHomePage /></FeatureOnly> },
  { path: '/register/personal',      element: <FeatureOnly feature="registration"><RegisterPersonal /></FeatureOnly> },
  { path: '/register/savings',       element: <FeatureOnly feature="registration"><RegisterSavings /></FeatureOnly> },
  { path: '/register/business',      element: <FeatureOnly feature="registration"><RegisterBusiness /></FeatureOnly> },
  { path: '/register/multi-currency', element: <FeatureOnly feature="registration"><RegisterMultiCurrency /></FeatureOnly> },
  { path: '/register/wealth',        element: <FeatureOnly feature="registration"><RegisterWealth /></FeatureOnly> },
  { path: '/application/status', element: <ApplicationStatus /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password',  element: <ResetPasswordPage /> },
  { path: '/plaid/oauth',     element: <CustomerOnly><PlaidOAuthPage /></CustomerOnly> },
  { path: '/dashboard',               element: <CustomerOnly><DashboardPage /></CustomerOnly> },
  { path: '/dashboard/cards',         element: <CustomerOnly><FeatureOnly feature="cards"><DashboardCards /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/analytics',     element: <CustomerOnly><FeatureOnly feature="analytics"><DashboardAnalytics /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/security',      element: <CustomerOnly><DashboardSecurity /></CustomerOnly> },
  { path: '/dashboard/wallets',       element: <CustomerOnly><FeatureOnly feature="wallets"><DashboardWallets /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/accounts',      element: <CustomerOnly><FeatureOnly feature="accounts"><DashboardAccounts /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/transfers',     element: <CustomerOnly><FeatureOnly feature="transfers"><DashboardTransfers /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/deposits',      element: <CustomerOnly><FeatureOnly feature="wallets"><DashboardDeposits /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/notifications', element: <CustomerOnly><FeatureOnly feature="notifications"><DashboardNotifications /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/profile',       element: <CustomerOnly><DashboardProfile /></CustomerOnly> },
  { path: '/dashboard/settings',      element: <CustomerOnly><DashboardSettings /></CustomerOnly> },
  { path: '/dashboard/statements',    element: <CustomerOnly><FeatureOnly feature="statements"><DashboardStatements /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/transactions',  element: <CustomerOnly><FeatureOnly feature="statements"><DashboardTransactions /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/devices',       element: <CustomerOnly><DashboardDevices /></CustomerOnly> },
  { path: '/dashboard/beneficiaries', element: <CustomerOnly><FeatureOnly feature="beneficiaries"><DashboardBeneficiaries /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/support',       element: <CustomerOnly><FeatureOnly feature="support"><DashboardSupport /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/disputes',      element: <CustomerOnly><DashboardDisputes /></CustomerOnly> },
  { path: '/dashboard/goals',         element: <CustomerOnly><FeatureOnly feature="savingsGoals"><DashboardGoals /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/bills',         element: <CustomerOnly><FeatureOnly feature="payments"><DashboardBills /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/payments',      element: <CustomerOnly><FeatureOnly feature="payments"><DashboardBills /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/rewards',       element: <CustomerOnly><FeatureOnly feature="rewards"><DashboardRewards /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/search',        element: <CustomerOnly><DashboardSearch /></CustomerOnly> },
  { path: '/dashboard/rates',         element: <CustomerOnly><FeatureOnly feature="fx"><DashboardRates /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/exchange',      element: <CustomerOnly><FeatureOnly feature="fx"><DashboardRates /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/trading',         element: <CustomerOnly><FeatureOnly feature="investments"><DashboardTrading /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/trading/markets',   element: <CustomerOnly><FeatureOnly feature="markets"><DashboardTradingMarkets /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/trading/orders',    element: <CustomerOnly><FeatureOnly feature="investments"><DashboardTradingOrders /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/trading/chart',     element: <CustomerOnly><FeatureOnly feature="markets"><DashboardTradingChart /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/trading/watchlist', element: <CustomerOnly><FeatureOnly feature="markets"><DashboardTradingWatchlist /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/trading/analytics', element: <CustomerOnly><FeatureOnly feature="investments"><DashboardTradingAnalytics /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/portfolio',         element: <CustomerOnly><FeatureOnly feature="investments"><DashboardTradingAnalytics /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/trading/spot',      element: <CustomerOnly><FeatureOnly feature="investments"><DashboardTradingSpot /></FeatureOnly></CustomerOnly> },
  { path: '/dashboard/trading/trades',    element: <CustomerOnly><FeatureOnly feature="investments"><DashboardTradingTrades /></FeatureOnly></CustomerOnly> },
  { path: '/kyc',                     element: <CustomerOnly><FeatureOnly feature="kyc"><OnboardingPage /></FeatureOnly></CustomerOnly> },
  { path: '/onboarding',              element: <CustomerOnly><FeatureOnly feature="kyc"><OnboardingPage /></FeatureOnly></CustomerOnly> },
  { path: '/onboarding/support',      element: <CustomerOnly><FeatureOnly feature="support"><DashboardSupport /></FeatureOnly></CustomerOnly> },
  // Admin routes (no RootLayout wrapper — AdminLayout handles its own chrome)
  { path: '/admin/login',             element: <AdminLoginPage /> },
  { path: '/admin/forgot-password',   element: <AdminForgotPasswordPage /> },
  { path: '/admin/reset-password',    element: <AdminResetPasswordPage /> },
  { path: '/admin',              element: <AdminOnly><AdminDashboard /></AdminOnly> },
  { path: '/admin/users',        element: <AdminOnly><AdminUsers /></AdminOnly> },
  { path: '/admin/customers',    element: <AdminOnly><AdminUsers /></AdminOnly> },
  { path: '/admin/customer-relationships', element: <AdminOnly><AdminCustomerRelationships /></AdminOnly> },
  { path: '/admin/cards',        element: <AdminOnly><AdminCards /></AdminOnly> },
  { path: '/admin/transactions', element: <AdminOnly><AdminTransactions /></AdminOnly> },
  { path: '/admin/transfers',    element: <AdminOnly><AdminTransactions view="transfers" /></AdminOnly> },
  { path: '/admin/crypto',       element: <AdminOnly><AdminCrypto /></AdminOnly> },
  { path: '/admin/banking',      element: <AdminOnly><AdminCustomerAccounts /></AdminOnly> },
  { path: '/admin/accounts',     element: <AdminOnly><AdminCustomerAccounts /></AdminOnly> },
  { path: '/admin/wallets',      element: <Navigate to="/admin/crypto" replace /> },
  { path: '/admin/support',      element: <AdminOnly><AdminSupport /></AdminOnly> },
  { path: '/admin/cms',          element: <AdminOnly><AdminCMS /></AdminOnly> },
  { path: '/admin/security',     element: <AdminOnly><AdminSecurity /></AdminOnly> },
  { path: '/admin/settings',     element: <AdminOnly><AdminConfig /></AdminOnly> },
  { path: '/admin/newsletter',   element: <AdminOnly><AdminNewsletter /></AdminOnly> },
  { path: '/admin/contacts',     element: <AdminOnly><AdminContacts /></AdminOnly> },
  { path: '/admin/operations',   element: <AdminOnly><AdminOperations /></AdminOnly> },
  { path: '/admin/smtp',         element: <AdminOnly><AdminSmtp /></AdminOnly> },
  { path: '/admin/zoho-setup',   element: <AdminOnly><AdminZohoSetup /></AdminOnly> },
  { path: '/admin/social',       element: <AdminOnly><AdminSocial /></AdminOnly> },
  { path: '/admin/chatbot',      element: <AdminOnly><AdminChatbot /></AdminOnly> },
  { path: '/admin/links',        element: <AdminOnly><AdminLinks /></AdminOnly> },
  { path: '/admin/website',      element: <AdminOnly><AdminWebsite /></AdminOnly> },
  { path: '/admin/rates',        element: <AdminOnly><AdminRates /></AdminOnly> },
  { path: '/admin/kyc',             element: <AdminOnly><PreserveSearchRedirect to="/admin/onboarding" /></AdminOnly> },
  { path: '/admin/onboarding',      element: <AdminOnly><AdminOnboarding /></AdminOnly> },
  { path: '/admin/sponsor-readiness', element: <AdminOnly><AdminSponsorReadiness /></AdminOnly> },
  { path: '/admin/readiness',       element: <AdminOnly><AdminReadiness /></AdminOnly> },
  { path: '/admin/reconciliation', element: <AdminOnly><AdminReconciliation /></AdminOnly> },
  { path: '/admin/disputes', element: <AdminOnly><AdminDisputes /></AdminOnly> },
  { path: '/admin/notifications',   element: <AdminOnly><AdminNotifications /></AdminOnly> },
  { path: '/admin/audit',           element: <AdminOnly><AdminAudit /></AdminOnly> },
  { path: '/admin/email',           element: <AdminOnly><AdminEmailCenter /></AdminOnly> },
  { path: '/admin/reports',         element: <AdminOnly><AdminReports /></AdminOnly> },
  { path: '/admin/compliance',      element: <AdminOnly><AdminCompliance /></AdminOnly> },
  { path: '/admin/media',           element: <AdminOnly><AdminMedia /></AdminOnly> },
  { path: '/admin/config',          element: <AdminOnly><AdminConfig /></AdminOnly> },
  { path: '/admin/features',        element: <AdminOnly><AdminFeatures /></AdminOnly> },
  { path: '/admin/applications',    element: <AdminOnly><AdminApplications /></AdminOnly> },
  { path: '/admin/financial-sandbox', element: <AdminOnly><AdminFinancialSandbox /></AdminOnly> },
  { path: '/admin/configuration',   element: <AdminOnly><AdminConfig /></AdminOnly> },
  { path: '/admin/integrations',    element: <AdminOnly><AdminIntegrations /></AdminOnly> },
  { path: '/admin/administrators',  element: <AdminOnly><AdminAdministrators /></AdminOnly> },
  { path: '/admin/deployments',     element: <AdminOnly><AdminDeployments /></AdminOnly> },
  { path: '/admin/database',        element: <AdminOnly><AdminDatabase /></AdminOnly> },
  { path: '/admin/trading',         element: <AdminOnly><AdminTrading /></AdminOnly> },
  { path: '/admin/system',          element: <AdminOnly><AdminSystem /></AdminOnly> },
  { path: '*', element: <NotFoundPage /> },
];
