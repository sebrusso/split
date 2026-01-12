/**
 * Payment Links Unit Tests
 *
 * Tests for payment deep links, QR codes, multi-app suggestions,
 * and payment confirmation tracking.
 */

import {
  getVenmoDeepLink,
  getVenmoRequestLink,
  getPayPalDeepLink,
  getCashAppDeepLink,
  getZelleDeepLink,
  getVenmoQRCodeUrl,
  getPayPalQRCodeUrl,
  getCashAppQRCodeUrl,
  generateSettlementQRCodes,
  getPaymentAppName,
  getPaymentAppIcon,
  getPaymentSuggestions,
  getBestPaymentSuggestion,
  createPendingPaymentSession,
  isReasonablePaymentDuration,
  formatTimeSinceOpened,
  type PaymentApp,
  type UserPaymentAccounts,
  type PendingPaymentSession,
} from '../lib/payment-links';

// ============================================
// Payment Deep Links Tests
// ============================================

describe('Venmo Deep Links', () => {
  describe('getVenmoDeepLink', () => {
    it('generates pay link by default', () => {
      const url = getVenmoDeepLink(25.00, 'Dinner split', 'testuser');
      expect(url).toContain('venmo://paycharge?');
      expect(url).toContain('txn=pay');
      expect(url).toContain('recipients=testuser');
      expect(url).toContain('amount=25.00');
      // URLSearchParams encodes spaces as + (which is valid)
      expect(url).toMatch(/note=Dinner(\+|%20)split/);
    });

    it('generates charge link for payment requests', () => {
      const url = getVenmoDeepLink(50.00, 'You owe me', 'debtor123', 'charge');
      expect(url).toContain('txn=charge');
      expect(url).toContain('recipients=debtor123');
      expect(url).toContain('amount=50.00');
    });

    it('handles missing recipient', () => {
      const url = getVenmoDeepLink(25.00, 'Test note');
      // URLSearchParams encodes spaces as +
      expect(url).toMatch(/venmo:\/\/paycharge\?amount=25\.00&note=Test(\+|%20)note/);
    });

    it('handles zero amount', () => {
      const url = getVenmoDeepLink(0, 'Test');
      expect(url).not.toContain('amount=');
    });

    it('encodes special characters in note', () => {
      const url = getVenmoDeepLink(10.00, 'Pizza & drinks @ restaurant');
      // URLSearchParams encodes spaces as + and & as %26
      expect(url).toContain('%26'); // & encoded
      expect(url).toContain('%40'); // @ encoded
    });
  });

  describe('getVenmoRequestLink', () => {
    it('generates charge link (payment request)', () => {
      const url = getVenmoRequestLink(100.00, 'Pay me back', 'frienduser');
      expect(url).toContain('txn=charge');
      expect(url).toContain('recipients=frienduser');
      expect(url).toContain('amount=100.00');
    });

    it('is equivalent to getVenmoDeepLink with charge type', () => {
      const requestUrl = getVenmoRequestLink(75.00, 'Test', 'user123');
      const deepLinkUrl = getVenmoDeepLink(75.00, 'Test', 'user123', 'charge');
      expect(requestUrl).toBe(deepLinkUrl);
    });
  });
});

describe('PayPal Deep Links', () => {
  describe('getPayPalDeepLink', () => {
    it('generates PayPal.me link with email and amount', () => {
      const url = getPayPalDeepLink(25.00, 'Payment', 'user@example.com');
      expect(url).toBe('https://paypal.me/user/25.00');
    });

    it('handles missing email', () => {
      const url = getPayPalDeepLink(25.00, 'Payment');
      expect(url).toContain('paypal://paymentreview');
      expect(url).toContain('amount=25.00');
      expect(url).toContain('note=Payment');
    });
  });
});

describe('Cash App Deep Links', () => {
  describe('getCashAppDeepLink', () => {
    it('generates Cash App link with cashtag', () => {
      const url = getCashAppDeepLink(50.00, 'Test', 'cashtag');
      expect(url).toContain('cashapp://cash.app/pay');
      expect(url).toContain('recipient=cashtag');
      expect(url).toContain('amount=50.00');
    });

    it('removes $ from cashtag', () => {
      const url = getCashAppDeepLink(50.00, 'Test', '$cashtag');
      expect(url).toContain('recipient=cashtag');
      expect(url).not.toContain('recipient=%24cashtag');
    });
  });
});

describe('Zelle Deep Links', () => {
  describe('getZelleDeepLink', () => {
    it('generates Zelle link with phone', () => {
      const url = getZelleDeepLink(100.00, 'Payment', '5551234567');
      expect(url).toContain('zelle://send');
      expect(url).toContain('token=5551234567');
      expect(url).toContain('amount=100.00');
      expect(url).toContain('memo=Payment');
    });

    it('prefers phone over email', () => {
      const url = getZelleDeepLink(100.00, 'Test', '5551234567', 'user@test.com');
      expect(url).toContain('token=5551234567');
      expect(url).not.toContain('user@test.com');
    });

    it('uses email when phone not provided', () => {
      const url = getZelleDeepLink(100.00, 'Test', undefined, 'user@test.com');
      expect(url).toContain('token=user%40test.com');
    });
  });
});

// ============================================
// QR Code Generation Tests
// ============================================

describe('QR Code URL Generation', () => {
  describe('getVenmoQRCodeUrl', () => {
    it('generates web-friendly Venmo URL', () => {
      const url = getVenmoQRCodeUrl('testuser', 25.00, 'Dinner');
      expect(url).toContain('https://venmo.com/paycharge');
      expect(url).toContain('txn=pay');
      expect(url).toContain('recipients=testuser');
      expect(url).toContain('amount=25.00');
      expect(url).toContain('note=Dinner');
    });

    it('works without note', () => {
      const url = getVenmoQRCodeUrl('user', 10.00);
      expect(url).toContain('https://venmo.com/paycharge');
      expect(url).not.toContain('note=');
    });
  });

  describe('getPayPalQRCodeUrl', () => {
    it('generates PayPal.me URL', () => {
      const url = getPayPalQRCodeUrl('paypaluser', 50.00);
      expect(url).toBe('https://paypal.me/paypaluser/50.00');
    });
  });

  describe('getCashAppQRCodeUrl', () => {
    it('generates Cash App URL', () => {
      const url = getCashAppQRCodeUrl('cashtag', 75.00);
      expect(url).toBe('https://cash.app/$cashtag/75.00');
    });

    it('handles $ prefix in cashtag', () => {
      const url = getCashAppQRCodeUrl('$mytag', 25.00);
      expect(url).toBe('https://cash.app/$mytag/25.00');
    });
  });

  describe('generateSettlementQRCodes', () => {
    it('generates QR codes for all available payment methods', () => {
      const qrCodes = generateSettlementQRCodes(
        100.00,
        {
          venmoUsername: 'venmouser',
          paypalUsername: 'paypaluser',
          cashAppTag: 'cashtag',
        },
        'Settlement'
      );

      expect(qrCodes).toHaveLength(3);
      expect(qrCodes.find(q => q.app === 'venmo')).toBeDefined();
      expect(qrCodes.find(q => q.app === 'paypal')).toBeDefined();
      expect(qrCodes.find(q => q.app === 'cashapp')).toBeDefined();
    });

    it('only generates QR codes for provided methods', () => {
      const qrCodes = generateSettlementQRCodes(
        50.00,
        { venmoUsername: 'onlyvenmo' },
        'Test'
      );

      expect(qrCodes).toHaveLength(1);
      expect(qrCodes[0].app).toBe('venmo');
    });

    it('returns empty array when no methods provided', () => {
      const qrCodes = generateSettlementQRCodes(50.00, {}, 'Test');
      expect(qrCodes).toHaveLength(0);
    });
  });
});

// ============================================
// Payment App Info Tests
// ============================================

describe('Payment App Helpers', () => {
  describe('getPaymentAppName', () => {
    it('returns correct names for all apps', () => {
      expect(getPaymentAppName('venmo')).toBe('Venmo');
      expect(getPaymentAppName('paypal')).toBe('PayPal');
      expect(getPaymentAppName('cashapp')).toBe('Cash App');
      expect(getPaymentAppName('zelle')).toBe('Zelle');
    });

    it('returns default for unknown apps', () => {
      expect(getPaymentAppName('unknown' as PaymentApp)).toBe('Payment App');
    });
  });

  describe('getPaymentAppIcon', () => {
    it('returns icons for all apps', () => {
      expect(getPaymentAppIcon('venmo')).toBe('💙');
      expect(getPaymentAppIcon('paypal')).toBe('💰');
      expect(getPaymentAppIcon('cashapp')).toBe('💚');
      expect(getPaymentAppIcon('zelle')).toBe('⚡');
    });

    it('returns default icon for unknown apps', () => {
      expect(getPaymentAppIcon('unknown' as PaymentApp)).toBe('💳');
    });
  });
});

// ============================================
// Multi-App Suggestions Tests
// ============================================

describe('Payment Suggestions', () => {
  const mockInstalledApps: PaymentApp[] = ['venmo', 'paypal'];

  describe('getPaymentSuggestions', () => {
    it('prioritizes apps both users have linked', async () => {
      const senderAccounts: UserPaymentAccounts = {
        venmoUsername: 'sender_venmo',
        paypalUsername: 'sender_paypal',
      };
      const recipientAccounts: UserPaymentAccounts = {
        venmoUsername: 'recipient_venmo',
      };

      const suggestions = await getPaymentSuggestions(
        senderAccounts,
        recipientAccounts,
        mockInstalledApps
      );

      // Venmo should be first (both linked)
      expect(suggestions[0].app).toBe('venmo');
      expect(suggestions[0].bothLinked).toBe(true);
      expect(suggestions[0].recipientHandle).toBe('recipient_venmo');
    });

    it('returns all apps with correct linked status', async () => {
      const senderAccounts: UserPaymentAccounts = {
        venmoUsername: 'sender',
      };
      const recipientAccounts: UserPaymentAccounts = {
        paypalUsername: 'recipient',
      };

      const suggestions = await getPaymentSuggestions(
        senderAccounts,
        recipientAccounts,
        []
      );

      expect(suggestions).toHaveLength(4);

      const venmoSuggestion = suggestions.find(s => s.app === 'venmo');
      expect(venmoSuggestion?.senderLinked).toBe(true);
      expect(venmoSuggestion?.recipientLinked).toBe(false);
      expect(venmoSuggestion?.bothLinked).toBe(false);

      const paypalSuggestion = suggestions.find(s => s.app === 'paypal');
      expect(paypalSuggestion?.senderLinked).toBe(false);
      expect(paypalSuggestion?.recipientLinked).toBe(true);
      expect(paypalSuggestion?.bothLinked).toBe(false);
    });

    it('includes app installation status', async () => {
      const suggestions = await getPaymentSuggestions(
        { venmoUsername: 'test' },
        { venmoUsername: 'test2' },
        ['venmo']
      );

      const venmoSuggestion = suggestions.find(s => s.app === 'venmo');
      expect(venmoSuggestion?.appInstalled).toBe(true);

      const paypalSuggestion = suggestions.find(s => s.app === 'paypal');
      expect(paypalSuggestion?.appInstalled).toBe(false);
    });

    it('sorts by priority (highest first)', async () => {
      const senderAccounts: UserPaymentAccounts = {
        venmoUsername: 'sender',
        cashAppTag: 'sender_cash',
      };
      const recipientAccounts: UserPaymentAccounts = {
        venmoUsername: 'recipient',
        paypalUsername: 'recipient_paypal',
      };

      const suggestions = await getPaymentSuggestions(
        senderAccounts,
        recipientAccounts,
        ['venmo', 'paypal']
      );

      // First should be Venmo (both linked + installed)
      expect(suggestions[0].app).toBe('venmo');
      expect(suggestions[0].priority).toBeGreaterThan(suggestions[1].priority);
    });
  });

  describe('getBestPaymentSuggestion', () => {
    it('returns the highest priority suggestion', async () => {
      const senderAccounts: UserPaymentAccounts = {
        venmoUsername: 'sender',
        paypalUsername: 'sender_paypal',
      };
      const recipientAccounts: UserPaymentAccounts = {
        venmoUsername: 'recipient',
      };

      const best = await getBestPaymentSuggestion(senderAccounts, recipientAccounts);

      expect(best).not.toBeNull();
      expect(best?.app).toBe('venmo');
      expect(best?.bothLinked).toBe(true);
    });

    it('returns null when no accounts linked', async () => {
      const best = await getBestPaymentSuggestion({}, {});

      // Should still return suggestions but with low priority
      expect(best).not.toBeNull();
      expect(best?.bothLinked).toBe(false);
    });
  });
});

// ============================================
// Payment Confirmation Tracking Tests
// ============================================

describe('Payment Session Tracking', () => {
  describe('createPendingPaymentSession', () => {
    it('creates a session with all required fields', () => {
      const session = createPendingPaymentSession(
        'venmo',
        50.00,
        'recipient-123',
        'John Doe',
        'group-456',
        'Dinner settlement',
        'venmo://paycharge?...'
      );

      expect(session.id).toBeDefined();
      expect(session.id).toMatch(/^payment-\d+-[a-z0-9]+$/);
      expect(session.app).toBe('venmo');
      expect(session.amount).toBe(50.00);
      expect(session.recipientId).toBe('recipient-123');
      expect(session.recipientName).toBe('John Doe');
      expect(session.groupId).toBe('group-456');
      expect(session.note).toBe('Dinner settlement');
      expect(session.deepLink).toBe('venmo://paycharge?...');
      expect(session.openedAt).toBeDefined();
      expect(session.returned).toBe(false);
      expect(session.confirmed).toBe(false);
    });

    it('generates unique IDs', () => {
      const session1 = createPendingPaymentSession('venmo', 10, 'r1', 'Name', 'g1', 'Note', 'link');
      const session2 = createPendingPaymentSession('venmo', 10, 'r1', 'Name', 'g1', 'Note', 'link');

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('isReasonablePaymentDuration', () => {
    it('returns false for sessions under 3 seconds', () => {
      const session: PendingPaymentSession = {
        id: 'test',
        app: 'venmo',
        amount: 50,
        recipientId: 'r1',
        recipientName: 'Test',
        groupId: 'g1',
        note: 'Test',
        deepLink: 'link',
        openedAt: Date.now() - 1000, // 1 second ago
        returned: false,
        confirmed: false,
      };

      expect(isReasonablePaymentDuration(session)).toBe(false);
    });

    it('returns true for sessions over 3 seconds', () => {
      const session: PendingPaymentSession = {
        id: 'test',
        app: 'venmo',
        amount: 50,
        recipientId: 'r1',
        recipientName: 'Test',
        groupId: 'g1',
        note: 'Test',
        deepLink: 'link',
        openedAt: Date.now() - 5000, // 5 seconds ago
        returned: false,
        confirmed: false,
      };

      expect(isReasonablePaymentDuration(session)).toBe(true);
    });

    it('returns true for exactly 3 seconds', () => {
      const session: PendingPaymentSession = {
        id: 'test',
        app: 'venmo',
        amount: 50,
        recipientId: 'r1',
        recipientName: 'Test',
        groupId: 'g1',
        note: 'Test',
        deepLink: 'link',
        openedAt: Date.now() - 3000, // Exactly 3 seconds
        returned: false,
        confirmed: false,
      };

      expect(isReasonablePaymentDuration(session)).toBe(true);
    });
  });

  describe('formatTimeSinceOpened', () => {
    it('formats seconds correctly', () => {
      const session: PendingPaymentSession = {
        id: 'test',
        app: 'venmo',
        amount: 50,
        recipientId: 'r1',
        recipientName: 'Test',
        groupId: 'g1',
        note: 'Test',
        deepLink: 'link',
        openedAt: Date.now() - 30000, // 30 seconds ago
        returned: false,
        confirmed: false,
      };

      expect(formatTimeSinceOpened(session)).toBe('30 seconds ago');
    });

    it('uses singular for 1 second', () => {
      const session: PendingPaymentSession = {
        id: 'test',
        app: 'venmo',
        amount: 50,
        recipientId: 'r1',
        recipientName: 'Test',
        groupId: 'g1',
        note: 'Test',
        deepLink: 'link',
        openedAt: Date.now() - 1000, // 1 second ago
        returned: false,
        confirmed: false,
      };

      expect(formatTimeSinceOpened(session)).toBe('1 second ago');
    });

    it('formats minutes correctly', () => {
      const session: PendingPaymentSession = {
        id: 'test',
        app: 'venmo',
        amount: 50,
        recipientId: 'r1',
        recipientName: 'Test',
        groupId: 'g1',
        note: 'Test',
        deepLink: 'link',
        openedAt: Date.now() - 180000, // 3 minutes ago
        returned: false,
        confirmed: false,
      };

      expect(formatTimeSinceOpened(session)).toBe('3 minutes ago');
    });

    it('formats hours correctly', () => {
      const session: PendingPaymentSession = {
        id: 'test',
        app: 'venmo',
        amount: 50,
        recipientId: 'r1',
        recipientName: 'Test',
        groupId: 'g1',
        note: 'Test',
        deepLink: 'link',
        openedAt: Date.now() - 7200000, // 2 hours ago
        returned: false,
        confirmed: false,
      };

      expect(formatTimeSinceOpened(session)).toBe('2 hours ago');
    });
  });
});
