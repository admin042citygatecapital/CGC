/**
 * Shared account-application flow definitions.
 *
 * Single source of truth for all five account-application journeys: the
 * client wizard renders steps/fields from these definitions and the server
 * validates every submitted step against the same validators. One engine,
 * five configurations — no per-type backend duplication.
 *
 * Client-safe: no server imports.
 */

export const ACCOUNT_TYPES = ['PERSONAL', 'SAVINGS', 'BUSINESS', 'MULTI_CURRENCY', 'WEALTH'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_PLANS = ['STANDARD', 'PREMIUM', 'ELITE'] as const;
export type AccountPlan = (typeof ACCOUNT_PLANS)[number];

export const APPLICATION_STATUSES = [
  'APPLICATION_STARTED',
  'EMAIL_VERIFICATION_REQUIRED',
  'EMAIL_VERIFIED',
  'INFORMATION_INCOMPLETE',
  'REVIEW_REQUIRED',
  'NEEDS_INFORMATION',
  'APPROVED',
  'REJECTED',
  'ACTIVATION_PENDING',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface AccountTypeMeta {
  type: AccountType;
  label: string;
  tagline: string;
  description: string;
  plans: readonly AccountPlan[];
}

/** Canonical URL slug per account type (never derive from display labels). */
export const ACCOUNT_TYPE_SLUGS: Record<AccountType, string> = {
  PERSONAL: 'personal', SAVINGS: 'savings', BUSINESS: 'business',
  MULTI_CURRENCY: 'multi-currency', WEALTH: 'wealth',
};

export const ACCOUNT_TYPE_META: Record<AccountType, AccountTypeMeta> = {
  PERSONAL: {
    type: 'PERSONAL', label: 'Personal', tagline: 'Everyday banking',
    description: 'A personal account for daily payments, transfers and spending controls.',
    plans: ['STANDARD', 'PREMIUM', 'ELITE'],
  },
  SAVINGS: {
    type: 'SAVINGS', label: 'Savings', tagline: 'Save with purpose',
    description: 'Structured savings with goals, targets and automatic contributions.',
    plans: ['STANDARD', 'PREMIUM', 'ELITE'],
  },
  BUSINESS: {
    type: 'BUSINESS', label: 'Business', tagline: 'For companies',
    description: 'Business account application with ownership, control and team-access setup.',
    plans: ['STANDARD', 'PREMIUM', 'ELITE'],
  },
  MULTI_CURRENCY: {
    type: 'MULTI_CURRENCY', label: 'Multi-Currency', tagline: 'Hold and exchange',
    description: 'Multi-currency balances with FX and international transfer tooling.',
    plans: ['STANDARD', 'PREMIUM', 'ELITE'],
  },
  WEALTH: {
    type: 'WEALTH', label: 'Wealth', tagline: 'Advisory relationship',
    description: 'Register your interest in the wealth relationship programme.',
    plans: ['STANDARD', 'PREMIUM', 'ELITE'],
  },
};

// ── Field validation ─────────────────────────────────────────────────────────

export type FieldType = 'text' | 'email' | 'password' | 'select' | 'textarea' | 'currency' | 'checkbox';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  optionalHint?: boolean;
  options?: readonly string[];
  maxLength?: number;
  hint?: string;
  placeholder?: string;
}

export interface StepDef {
  id: string;
  title: string;
  description: string;
  fields: readonly FieldDef[];
}

export const CONTACT_STEP: StepDef = {
  id: 'contact',
  title: 'Login identity',
  description: 'Your email is your login ID. Choose a strong password.',
  fields: [
    { name: 'email', label: 'Email address', type: 'email', required: true },
    { name: 'password', label: 'Password', type: 'password', required: true, hint: 'Minimum 10 characters with upper, lower, number and symbol.' },
    { name: 'confirmPassword', label: 'Confirm password', type: 'password', required: true },
    { name: 'acceptTerms', label: 'I accept the Terms of Service and Privacy Policy', type: 'checkbox', required: true },
  ],
};

const PERSONAL_INFO_STEP: StepDef = {
  id: 'personal',
  title: 'Personal information',
  description: 'Information about you as the account holder or authorised representative.',
  fields: [
    { name: 'firstName', label: 'Legal first name', type: 'text', required: true },
    { name: 'middleName', label: 'Middle name', type: 'text', required: false, optionalHint: true },
    { name: 'lastName', label: 'Legal surname', type: 'text', required: true },
    { name: 'dob', label: 'Date of birth', type: 'text', required: true, placeholder: 'YYYY-MM-DD' },
    { name: 'country', label: 'Country of residence', type: 'text', required: true },
    { name: 'nationality', label: 'Nationality', type: 'text', required: true },
    { name: 'address', label: 'Residential address', type: 'text', required: true },
    { name: 'city', label: 'City', type: 'text', required: true },
    { name: 'region', label: 'Region / state', type: 'text', required: false, optionalHint: true },
    { name: 'postalCode', label: 'Postal code', type: 'text', required: true },
    { name: 'phone', label: 'Phone number', type: 'text', required: true },
  ],
};

const SECURITY_STEP: StepDef = {
  id: 'security',
  title: 'Security setup',
  description: 'Configure how you protect and recover your account.',
  fields: [
    { name: 'enableTwoFactor', label: 'Enable two-factor authentication after activation', type: 'checkbox', required: false, hint: 'Strongly recommended. Can also be enabled later from Security settings.' },
    { name: 'loginAlerts', label: 'Email me about new logins and devices', type: 'checkbox', required: false },
  ],
};

const PLANS: readonly string[] = ACCOUNT_PLANS;

const REVIEW_STEP: StepDef = {
  id: 'review',
  title: 'Review & submit',
  description: 'Check your application before submitting. You can edit any section first.',
  fields: [],
};

const ACTIVITY_RANGES = ['Under 10,000', '10,000 – 50,000', '50,000 – 250,000', '250,000 – 1,000,000', 'Over 1,000,000'] as const;
const EMPLOYMENT = ['Employed', 'Self-employed', 'Business owner', 'Retired', 'Student', 'Other'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'AED', 'CAD'] as const;

export const APPLICATION_FLOWS: Record<AccountType, readonly StepDef[]> = {
  PERSONAL: [
    CONTACT_STEP,
    PERSONAL_INFO_STEP,
    {
      id: 'preferences',
      title: 'Account preferences',
      description: 'How you intend to use the account.',
      fields: [
        { name: 'intendedUse', label: 'Intended account use', type: 'select', required: true, options: ['Everyday banking', 'Receiving salary', 'Online purchases', 'Family support', 'Other'] },
        { name: 'primaryCurrency', label: 'Primary currency', type: 'select', required: true, options: CURRENCIES },
        { name: 'employmentCategory', label: 'Employment category', type: 'select', required: true, options: EMPLOYMENT },
        { name: 'activityRange', label: 'Approximate annual account activity', type: 'select', required: true, options: ACTIVITY_RANGES },
        { name: 'transferActivity', label: 'Expected transfer activity', type: 'select', required: true, options: ['Rarely', 'Monthly', 'Weekly', 'Daily'] },
        { name: 'plan', label: 'Preferred plan', type: 'select', required: true, options: PLANS },
      ],
    },
    { id: 'verification', title: 'Verification', description: 'Verify your email address to continue.', fields: [] },
    SECURITY_STEP,
    REVIEW_STEP,
  ],
  SAVINGS: [
    CONTACT_STEP,
    PERSONAL_INFO_STEP,
    {
      id: 'savings',
      title: 'Savings profile',
      description: 'What you are saving for. Projections shown in the app are illustrative only.',
      fields: [
        { name: 'purpose', label: 'Savings purpose', type: 'select', required: true, options: ['Emergency fund', 'Property', 'Education', 'Travel', 'Business capital', 'Other'] },
        { name: 'goal', label: 'Savings goal', type: 'text', required: true, maxLength: 120 },
        { name: 'targetAmount', label: 'Target amount', type: 'currency', required: true },
        { name: 'timeframe', label: 'Target timeframe', type: 'select', required: true, options: ['6 months', '1 year', '2 years', '5 years', 'Longer'] },
        { name: 'currency', label: 'Preferred currency', type: 'select', required: true, options: CURRENCIES },
        { name: 'autoSave', label: 'Auto-save preference', type: 'select', required: true, options: ['Manual only', 'Weekly', 'Monthly'] },
        { name: 'existingRelationship', label: 'Existing customer relationship', type: 'select', required: true, options: ['New customer', 'Existing personal account', 'Existing business account'] },
        { name: 'plan', label: 'Preferred plan', type: 'select', required: true, options: PLANS },
      ],
    },
    { id: 'verification', title: 'Verification', description: 'Verify your email address to continue.', fields: [] },
    SECURITY_STEP,
    REVIEW_STEP,
  ],
  BUSINESS: [
    CONTACT_STEP,
    PERSONAL_INFO_STEP,
    {
      id: 'business',
      title: 'Business details',
      description: 'Legal information about the entity applying.',
      fields: [
        { name: 'legalName', label: 'Legal business name', type: 'text', required: true },
        { name: 'tradingName', label: 'Trading name', type: 'text', required: false, optionalHint: true },
        { name: 'entityType', label: 'Entity type', type: 'select', required: true, options: ['Limited company', 'LLC', 'Partnership', 'Sole proprietorship', 'Other'] },
        { name: 'incorporationCountry', label: 'Incorporation country', type: 'text', required: true },
        { name: 'registrationNumber', label: 'Company registration number', type: 'text', required: true },
        { name: 'registeredAddress', label: 'Registered address', type: 'text', required: true },
        { name: 'operatingAddress', label: 'Operating address', type: 'text', required: false, optionalHint: true },
        { name: 'website', label: 'Business website', type: 'text', required: false, optionalHint: true },
        { name: 'industry', label: 'Industry', type: 'text', required: true },
        { name: 'description', label: 'Business description', type: 'textarea', required: true, maxLength: 1000 },
        { name: 'monthlyActivity', label: 'Expected monthly activity', type: 'select', required: true, options: ACTIVITY_RANGES },
        { name: 'transactionVolume', label: 'Expected monthly transaction volume', type: 'select', required: true, options: ['Under 50', '50 – 500', '500 – 5,000', 'Over 5,000'] },
        { name: 'requiredCurrencies', label: 'Required currencies (comma-separated)', type: 'text', required: true, placeholder: 'USD, EUR, GBP' },
      ],
    },
    {
      id: 'ownership',
      title: 'Ownership & control',
      description: 'Directors, beneficial owners and team access. Provisioning happens only after approval.',
      fields: [
        { name: 'directors', label: 'Directors (one per line: Full Name — Role)', type: 'textarea', required: true },
        { name: 'beneficialOwners', label: 'Beneficial owners over 25% (one per line: Name — Ownership %)', type: 'textarea', required: true },
        { name: 'teamAccess', label: 'Team access roles needed (one per line: Name — Owner/Administrator/Finance/Approver/Viewer)', type: 'textarea', required: true },
      ],
    },
    { id: 'verification', title: 'Verification', description: 'Verify your email address to continue.', fields: [] },
    SECURITY_STEP,
    REVIEW_STEP,
  ],
  MULTI_CURRENCY: [
    CONTACT_STEP,
    PERSONAL_INFO_STEP,
    {
      id: 'multiCurrency',
      title: 'Currency profile',
      description: 'Availability is configuration-driven — only enabled currencies and corridors can be requested.',
      fields: [
        { name: 'customerType', label: 'Customer type', type: 'select', required: true, options: ['Individual', 'Business'] },
        { name: 'primaryCurrency', label: 'Primary currency', type: 'select', required: true, options: CURRENCIES },
        { name: 'requiredCurrencies', label: 'Required currencies (comma-separated)', type: 'text', required: true, placeholder: 'USD, EUR' },
        { name: 'activityCountries', label: 'Countries where activity is expected (comma-separated)', type: 'text', required: true },
        { name: 'fxUsage', label: 'Expected FX usage', type: 'select', required: true, options: ['Occasional', 'Monthly', 'Weekly', 'Daily'] },
        { name: 'internationalTransfers', label: 'Expected international transfer activity', type: 'select', required: true, options: ['Rarely', 'Monthly', 'Weekly', 'Daily'] },
        { name: 'purpose', label: 'Account purpose', type: 'textarea', required: true, maxLength: 500 },
        { name: 'plan', label: 'Preferred plan', type: 'select', required: true, options: PLANS },
      ],
    },
    { id: 'verification', title: 'Verification', description: 'Verify your email address to continue.', fields: [] },
    SECURITY_STEP,
    REVIEW_STEP,
  ],
  WEALTH: [
    CONTACT_STEP,
    PERSONAL_INFO_STEP,
    {
      id: 'wealth',
      title: 'Wealth profile',
      description: 'Application for the wealth relationship programme. Services activate only after regulatory arrangements are in place.',
      fields: [
        { name: 'customerType', label: 'Customer type', type: 'select', required: true, options: ['Individual', 'Business', 'Family office'] },
        { name: 'objectives', label: 'Financial objectives', type: 'textarea', required: true, maxLength: 800 },
        { name: 'experience', label: 'Investment experience', type: 'select', required: true, options: ['None', 'Basic', 'Intermediate', 'Advanced', 'Professional'] },
        { name: 'serviceRequirements', label: 'Intended service requirements', type: 'textarea', required: true, maxLength: 800 },
        { name: 'reportingCurrency', label: 'Preferred reporting currency', type: 'select', required: true, options: CURRENCIES },
        { name: 'supportPreference', label: 'Relationship-support preference', type: 'select', required: true, options: ['Dedicated manager', 'Team coverage', 'Digital only'] },
      ],
    },
    { id: 'verification', title: 'Verification', description: 'Verify your email address to continue.', fields: [] },
    SECURITY_STEP,
    REVIEW_STEP,
  ],
};

// ── Validation (shared client + server) ──────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
export function passwordProblem(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < 10) return 'Password must be at least 10 characters.';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
    return 'Password needs upper and lower case letters, a number and a symbol.';
  }
  return null;
}

export function validateStep(step: StepDef, data: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of step.fields) {
    const raw = data[field.name];
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (field.type === 'checkbox') {
      if (field.required && value !== true) errors[field.name] = 'This acknowledgement is required.';
      continue;
    }
    if (typeof value !== 'string' || value.length === 0) {
      if (field.required) errors[field.name] = `${field.label} is required.`;
      continue;
    }
    if (field.maxLength && value.length > field.maxLength) {
      errors[field.name] = `${field.label} is limited to ${field.maxLength} characters.`;
      continue;
    }
    if (field.type === 'email' && !EMAIL_RE.test(value)) errors[field.name] = 'Enter a valid email address.';
    if (field.name === 'dob') {
      if (!DOB_RE.test(value)) { errors[field.name] = 'Use the YYYY-MM-DD format.'; }
      else {
        const d = new Date(value + 'T00:00:00Z');
        if (Number.isNaN(d.getTime()) || d > new Date() || d < new Date('1900-01-01')) {
          errors[field.name] = 'Enter a valid date of birth.';
        }
      }
    }
    if (field.type === 'currency' && !/^[0-9]+([.,][0-9]{1,2})?$/.test(value)) {
      errors[field.name] = 'Enter a valid amount (digits only, optional decimals).';
    }
    if (field.name === 'password') {
      const problem = passwordProblem(value);
      if (problem) errors[field.name] = problem;
    }
    if (field.name === 'confirmPassword' && value !== data.password) {
      errors[field.name] = 'Passwords do not match.';
    }
    if (field.type === 'select' && field.options && !field.options.includes(value)) {
      errors[field.name] = 'Choose one of the listed options.';
    }
  }
  return errors;
}

export function stepIdsFor(type: AccountType): string[] {
  return APPLICATION_FLOWS[type].map(s => s.id);
}

export function completionPct(type: AccountType, completed: Record<string, unknown>): number {
  const steps = APPLICATION_FLOWS[type].filter(s => s.id !== 'review');
  const done = steps.filter(s => completed[s.id]).length;
  return Math.round((done / steps.length) * 100);
}