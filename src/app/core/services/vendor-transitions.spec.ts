import { legalVendorActions } from './vendor-transitions';

describe('legalVendorActions', () => {
  it('offers approve and reject on a pending vendor', () => {
    expect(legalVendorActions('pending')).toEqual(['approve', 'reject']);
  });

  it('offers only suspend on a verified vendor', () => {
    expect(legalVendorActions('verified')).toEqual(['suspend']);
  });

  it('offers only approve on a rejected vendor', () => {
    // Not reinstate: the server allows reinstate from `suspended` alone, so
    // offering it here produced a guaranteed 409. A rejected vendor who fixes
    // their documents is approved, not reinstated.
    expect(legalVendorActions('rejected')).toEqual(['approve']);
  });

  it('offers only reinstate on a suspended vendor', () => {
    expect(legalVendorActions('suspended')).toEqual(['reinstate']);
  });

  it('never offers an action the server would reject', () => {
    // Mirrors Domain/Entities/Vendor.cs exactly. If this table and the domain
    // ever disagree, the UI offers a button that always 409s — which is the
    // whole defect F9 exists to close.
    const serverRules: Record<string, string[]> = {
      approve: ['pending', 'rejected'],
      reject: ['pending'],
      suspend: ['verified'],
      reinstate: ['suspended'],
    };

    for (const status of ['pending', 'verified', 'rejected', 'suspended'] as const) {
      for (const action of legalVendorActions(status)) {
        expect(serverRules[action]).toContain(status);
      }
    }
  });
});
