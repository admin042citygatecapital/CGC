import { useAdminAuth } from '@/lib/adminAuth';
import { useCustomerAuth } from '@/lib/customerAuth';
import { lazy,useEffect,type ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate, useNavigate } from 'react-router-dom';

export type Path = string;
export type Params = Record<string, string | undefined>;

/** Redirect to /admin/login if not authenticated as admin */
function AdminOnly({ children }: { children: ReactNode }) {
  const { admin, loading } = useAdminAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !admin) navigate('/admin/login', { replace: true });
  }, [admin, loading, navigate]);
  if (loading || !admin) return null;
  return <>{children}</>;
}

/** Redirect to /login if not authenticated as customer */
function CustomerOnly({ children }: { children: ReactNode }) {
  const { customer, loading } = useCustomerAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);
  if (loading || !customer) return null;
  return <>{children}</>;
}

const HomePage = lazy(() => import('./pages/index'));
const AboutPage = lazy(() => import('./pages/about'));
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
const RegisterPage      = lazy(() => import('./pages/register'));
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
const DashboardDevices       = lazy(() => import('./pages/dashboard/devices'));
const DashboardBeneficiaries = lazy(() => import('./pages/dashboard/beneficiaries'));
const DashboardSupport       = lazy(() => import('./pages/dashboard/support'));
const DashboardDisputes      = lazy(() => import('./pages/dashboard/disputes'));
const DashboardGoals         = lazy(() => import('./pages/dashboard/goals'));
const DashboardBills         = lazy(() => import('./pages/dashboard/bills'));
const DashboardRewards       = lazy(() => import('./pages/dashboard/rewards'));
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
const AdminKyc             = lazy(() => import('./pages/admin/kyc'));
const AdminOnboarding      = lazy(() => import('./pages/admin/onboarding'));
const AdminDocumentation   = lazy(() => import('./pages/admin/documentation'));
const AdminReadiness       = lazy(() => import('./pages/admin/readiness'));
const AdminSponsorReadiness = lazy(() => import('./pages/admin/sponsor-readiness'));
const AdminProviderSandbox  = lazy(() => import('./pages/admin/provider-sandbox'));
const AdminFinancialSandbox = lazy(() => import('./pages/admin/financial-sandbox'));
const AdminReconciliation = lazy(() => import('./pages/admin/reconciliation'));
const AdminDisputes = lazy(() => import('./pages/admin/disputes'));
const AdminAssuranceExercises = lazy(() => import('./pages/admin/assurance-exercises'));
const AdminLegalEntity = lazy(() => import('./pages/admin/legal-entity'));
const AdminDeveloper       = lazy(() => import('./pages/admin/developer'));
const AdminEmailCenter     = lazy(() => import('./pages/admin/email'));
const AdminAudit           = lazy(() => import('./pages/admin/audit'));
const AdminReports         = lazy(() => import('./pages/admin/reports'));
const AdminCompliance      = lazy(() => import('./pages/admin/compliance'));
const AdminMedia           = lazy(() => import('./pages/admin/media'));
const AdminConfig          = lazy(() => import('./pages/admin/config'));
const AdminIntegrations    = lazy(() => import('./pages/admin/integrations'));
const AdminTrading         = lazy(() => import('./pages/admin/trading'));
const OnboardingPage       = lazy(() => import('./pages/onboarding'));

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/demo', element: <Navigate to="/" replace /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/our-story', element: <OurStoryPage /> },
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
  { path: '/register',        element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password',  element: <ResetPasswordPage /> },
  { path: '/plaid/oauth',     element: <CustomerOnly><PlaidOAuthPage /></CustomerOnly> },
  { path: '/dashboard',               element: <CustomerOnly><DashboardPage /></CustomerOnly> },
  { path: '/dashboard/cards',         element: <CustomerOnly><DashboardCards /></CustomerOnly> },
  { path: '/dashboard/analytics',     element: <CustomerOnly><DashboardAnalytics /></CustomerOnly> },
  { path: '/dashboard/security',      element: <CustomerOnly><DashboardSecurity /></CustomerOnly> },
  { path: '/dashboard/wallets',       element: <CustomerOnly><DashboardWallets /></CustomerOnly> },
  { path: '/dashboard/accounts',      element: <CustomerOnly><DashboardAccounts /></CustomerOnly> },
  { path: '/dashboard/transfers',     element: <CustomerOnly><DashboardTransfers /></CustomerOnly> },
  { path: '/dashboard/deposits',      element: <CustomerOnly><DashboardDeposits /></CustomerOnly> },
  { path: '/dashboard/notifications', element: <CustomerOnly><DashboardNotifications /></CustomerOnly> },
  { path: '/dashboard/profile',       element: <CustomerOnly><DashboardProfile /></CustomerOnly> },
  { path: '/dashboard/settings',      element: <CustomerOnly><DashboardSettings /></CustomerOnly> },
  { path: '/dashboard/statements',    element: <CustomerOnly><DashboardStatements /></CustomerOnly> },
  { path: '/dashboard/transactions',  element: <CustomerOnly><DashboardStatements /></CustomerOnly> },
  { path: '/dashboard/devices',       element: <CustomerOnly><DashboardDevices /></CustomerOnly> },
  { path: '/dashboard/beneficiaries', element: <CustomerOnly><DashboardBeneficiaries /></CustomerOnly> },
  { path: '/dashboard/support',       element: <CustomerOnly><DashboardSupport /></CustomerOnly> },
  { path: '/dashboard/disputes',      element: <CustomerOnly><DashboardDisputes /></CustomerOnly> },
  { path: '/dashboard/goals',         element: <CustomerOnly><DashboardGoals /></CustomerOnly> },
  { path: '/dashboard/bills',         element: <CustomerOnly><DashboardBills /></CustomerOnly> },
  { path: '/dashboard/payments',      element: <CustomerOnly><DashboardBills /></CustomerOnly> },
  { path: '/dashboard/rewards',       element: <CustomerOnly><DashboardRewards /></CustomerOnly> },
  { path: '/dashboard/rates',         element: <CustomerOnly><DashboardRates /></CustomerOnly> },
  { path: '/dashboard/exchange',      element: <CustomerOnly><DashboardRates /></CustomerOnly> },
  { path: '/dashboard/trading',         element: <CustomerOnly><DashboardTrading /></CustomerOnly> },
  { path: '/dashboard/trading/markets',   element: <CustomerOnly><DashboardTradingMarkets /></CustomerOnly> },
  { path: '/dashboard/trading/orders',    element: <CustomerOnly><DashboardTradingOrders /></CustomerOnly> },
  { path: '/dashboard/trading/chart',     element: <CustomerOnly><DashboardTradingChart /></CustomerOnly> },
  { path: '/dashboard/trading/watchlist', element: <CustomerOnly><DashboardTradingWatchlist /></CustomerOnly> },
  { path: '/dashboard/trading/analytics', element: <CustomerOnly><DashboardTradingAnalytics /></CustomerOnly> },
  { path: '/dashboard/portfolio',         element: <CustomerOnly><DashboardTradingAnalytics /></CustomerOnly> },
  { path: '/dashboard/trading/spot',      element: <CustomerOnly><DashboardTradingSpot /></CustomerOnly> },
  { path: '/dashboard/trading/trades',    element: <CustomerOnly><DashboardTradingTrades /></CustomerOnly> },
  { path: '/kyc',                     element: <CustomerOnly><OnboardingPage /></CustomerOnly> },
  { path: '/onboarding',              element: <CustomerOnly><OnboardingPage /></CustomerOnly> },
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
  { path: '/admin/transfers',    element: <AdminOnly><AdminTransactions /></AdminOnly> },
  { path: '/admin/crypto',       element: <AdminOnly><AdminCrypto /></AdminOnly> },
  { path: '/admin/banking',      element: <AdminOnly><AdminCustomerAccounts /></AdminOnly> },
  { path: '/admin/accounts',     element: <AdminOnly><AdminCustomerAccounts /></AdminOnly> },
  { path: '/admin/wallets',      element: <AdminOnly><AdminFinancialSandbox /></AdminOnly> },
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
  { path: '/admin/kyc',             element: <AdminOnly><AdminKyc /></AdminOnly> },
  { path: '/admin/onboarding',      element: <AdminOnly><AdminOnboarding /></AdminOnly> },
  { path: '/admin/documentation',   element: <AdminOnly><AdminDocumentation /></AdminOnly> },
  { path: '/admin/readiness',       element: <AdminOnly><AdminReadiness /></AdminOnly> },
  { path: '/admin/sponsor-readiness', element: <AdminOnly><AdminSponsorReadiness /></AdminOnly> },
  { path: '/admin/provider-sandbox', element: <AdminOnly><AdminProviderSandbox /></AdminOnly> },
  { path: '/admin/financial-sandbox', element: <AdminOnly><AdminFinancialSandbox /></AdminOnly> },
  { path: '/admin/reconciliation', element: <AdminOnly><AdminReconciliation /></AdminOnly> },
  { path: '/admin/disputes', element: <AdminOnly><AdminDisputes /></AdminOnly> },
  { path: '/admin/assurance-exercises', element: <AdminOnly><AdminAssuranceExercises /></AdminOnly> },
  { path: '/admin/legal-entity', element: <AdminOnly><AdminLegalEntity /></AdminOnly> },
  { path: '/admin/developer',       element: <AdminOnly><AdminDeveloper /></AdminOnly> },
  { path: '/admin/audit',           element: <AdminOnly><AdminAudit /></AdminOnly> },
  { path: '/admin/email',           element: <AdminOnly><AdminEmailCenter /></AdminOnly> },
  { path: '/admin/reports',         element: <AdminOnly><AdminReports /></AdminOnly> },
  { path: '/admin/compliance',      element: <AdminOnly><AdminCompliance /></AdminOnly> },
  { path: '/admin/media',           element: <AdminOnly><AdminMedia /></AdminOnly> },
  { path: '/admin/config',          element: <AdminOnly><AdminConfig /></AdminOnly> },
  { path: '/admin/configuration',   element: <AdminOnly><AdminConfig /></AdminOnly> },
  { path: '/admin/integrations',    element: <AdminOnly><AdminIntegrations /></AdminOnly> },
  { path: '/admin/trading',         element: <AdminOnly><AdminTrading /></AdminOnly> },
  { path: '/admin/system',          element: <AdminOnly><AdminReadiness /></AdminOnly> },
  { path: '*', element: <NotFoundPage /> },
];
