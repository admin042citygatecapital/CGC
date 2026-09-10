export const WORKFLOW_CONTROL_KEYS = ['kycApprovalsEnabled', 'sandboxFinancialControlsEnabled'] as const;

/** Only deliberate edits belong in a protected-control write. */
export function workflowControlPatch(current: Record<string, unknown>, baseline: Record<string, unknown>) {
  const data = { ...current };
  for (const key of WORKFLOW_CONTROL_KEYS) {
    if (current[key] === baseline[key]) delete data[key];
  }
  return data;
}
