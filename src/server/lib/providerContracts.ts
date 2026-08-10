/** Provider-neutral contracts. These interfaces do not contain live adapters. */
export type Currency = 'GBP' | 'EUR' | 'USD' | 'CAD' | 'AUD' | 'CHF';
export type ProviderStatus = 'pending' | 'accepted' | 'rejected' | 'reversed' | 'failed';

export interface ProviderCommand {
  idempotencyKey: string;
  correlationId: string;
}
export interface ProviderResult { providerId: string; correlationId: string; status: ProviderStatus; }
export interface SignedWebhookEnvelope<T> {
  eventId: string; timestamp: string; signature: string; payload: T;
}
export interface IdentityProvider { verifyIndividual(command: ProviderCommand & { subjectRef: string }): Promise<ProviderResult>; }
export interface KyBProvider { verifyBusiness(command: ProviderCommand & { businessRef: string; beneficialOwnerRefs: string[] }): Promise<ProviderResult>; }
export interface ScreeningProvider { screen(command: ProviderCommand & { subjectRef: string; reason: 'onboarding' | 'payment' | 'rescreen' }): Promise<ProviderResult>; }
export interface AccountProvider { createAccount(command: ProviderCommand & { customerRef: string; currencies: Currency[] }): Promise<ProviderResult>; }
export interface FxProvider { quote(command: ProviderCommand & { sell: Currency; buy: Currency; amount: string }): Promise<ProviderResult & { quoteId: string; expiresAt: string }>; convert(command: ProviderCommand & { quoteId: string }): Promise<ProviderResult>; }
export interface PaymentProvider { execute(command: ProviderCommand & { paymentRef: string; corridorId: string }): Promise<ProviderResult>; reverse(command: ProviderCommand & { providerPaymentId: string; reason: string }): Promise<ProviderResult>; }
export interface LedgerProvider { post(command: ProviderCommand & { postingBatchId: string; entries: Array<{ accountRef: string; debit?: string; credit?: string; currency: Currency }> }): Promise<ProviderResult>; }
export interface ReconciliationProvider { reconcile(command: ProviderCommand & { reconciliationId: string; businessDate: string; providerStatementRef: string }): Promise<ProviderResult & { breakCount: number }>; }

export function validateProviderEnvelope(input: Partial<SignedWebhookEnvelope<unknown>>): string[] {
  const gaps: string[] = [];
  if (!input.eventId?.trim()) gaps.push('eventId is required for replay protection');
  if (!input.timestamp?.trim()) gaps.push('timestamp is required');
  if (!input.signature?.trim()) gaps.push('signature is required');
  return gaps;
}

export function validateProviderCommand(input: Partial<ProviderCommand>): string[] {
  const gaps: string[] = [];
  if (!input.idempotencyKey?.trim()) gaps.push('idempotencyKey is required');
  if (!input.correlationId?.trim()) gaps.push('correlationId is required');
  return gaps;
}
