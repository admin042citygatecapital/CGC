import ApplicationWizard from '../../components/application/ApplicationWizard';
import type { AccountType } from '../../shared/applicationFlow';

export default function RegisterPage() {
  return <ApplicationWizard type={'MULTI_CURRENCY' as AccountType} />;
}
