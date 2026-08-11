import { describe, expect, it } from 'vitest';
import { assessControlledPilotReadiness, CONTROLLED_PILOT_CONTROLS } from '../../server/lib/pilotReadiness.js';

const controls = CONTROLLED_PILOT_CONTROLS.map(key => ({ key, title: key, status: 'approved' }));

describe('controlled pilot readiness', () => {
  it('requires verified ownership, package approval, controls and both rehearsal types', () => {
    const ready = assessControlledPilotReadiness({ legalEntityState: 'verified', packageApproved: true, controls, runs: [{ subjectType: 'individual', status: 'passed' }, { subjectType: 'business', status: 'passed' }] });
    expect(ready.rehearsalReady).toBe(true);
    expect(ready.realFundsEnabled).toBe(false);
    expect(ready.liveProviderAdaptersImplemented).toBe(false);
  });

  it('reports missing evidence and rehearsals without unlocking funds', () => {
    const state = assessControlledPilotReadiness({ legalEntityState: 'unverified', packageApproved: false, controls: controls.filter(item => item.key !== 'penetration_test'), runs: [] });
    expect(state.rehearsalReady).toBe(false);
    expect(state.controlGaps).toContainEqual(expect.objectContaining({ key: 'penetration_test' }));
    expect(state.gates.filter(gate => !gate.passed).map(gate => gate.key)).toEqual(expect.arrayContaining(['legal_entity', 'sponsor_package', 'individual_rehearsal', 'business_rehearsal', 'pilot_controls']));
    expect(state.realFundsEnabled).toBe(false);
  });
});
