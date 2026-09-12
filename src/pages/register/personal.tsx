import ApplicationWizard from '../../components/application/ApplicationWizard';
import type { AccountType } from '../../shared/applicationFlow';

export default function RegisterPage() {
  return <ApplicationWizard type={'PERSONAL' as AccountType} />;
}
