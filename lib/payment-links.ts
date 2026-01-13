/**
 * Payment App Deep Links
 *
 * Utilities for generating deep links to popular payment apps
 * to pre-fill payment screens with amount and note.
 */

import { Linking, Alert, Platform } from 'react-native';

export type PaymentApp = 'venmo' | 'paypal' | 'cashapp' | 'zelle';

/**
 * Transaction type for payment links
 * - 'pay': Send money (default)
 * - 'charge': Request money
 */
export type TransactionType = 'pay' | 'charge';

interface PaymentLinkParams {
  amount: number;
  note?: string;
  recipient?: string;
  email?: string;
  phone?: string;
  cashtag?: string;
  /** Transaction type: 'pay' to send money, 'charge' to request money */
  txnType?: TransactionType;
}

/**
 * Generate a Venmo deep link for payments or requests
 * @param amount - Payment amount
 * @param note - Payment note/description
 * @param recipient - Venmo username (without @)
 * @param txnType - Transaction type: 'pay' to send money, 'charge' to request money
 * @returns Venmo deep link URL
 */
export function getVenmoDeepLink(
  amount: number,
  note?: string,
  recipient?: string,
  txnType: TransactionType = 'pay'
): string {
  const params = new URLSearchParams();

  if (recipient) {
    params.append('txn', txnType);
    params.append('recipients', recipient);
  }

  if (amount > 0) {
    params.append('amount', amount.toFixed(2));
  }

  if (note) {
    params.append('note', note);
  }

  return `venmo://paycharge?${params.toString()}`;
}

/**
 * Generate a Venmo payment request deep link (shorthand for txn=charge)
 * @param amount - Request amount
 * @param note - Request note/description
 * @param recipient - Venmo username to request money from (without @)
 * @returns Venmo deep link URL for payment request
 */
export function getVenmoRequestLink(
  amount: number,
  note?: string,
  recipient?: string
): string {
  return getVenmoDeepLink(amount, note, recipient, 'charge');
}

/**
 * Generate a PayPal deep link
 * @param amount - Payment amount
 * @param note - Payment note/description
 * @param email - Recipient's PayPal email
 * @returns PayPal deep link URL
 */
export function getPayPalDeepLink(
  amount: number,
  note?: string,
  email?: string
): string {
  const params = new URLSearchParams();

  if (email) {
    params.append('recipient', email);
  }

  if (amount > 0) {
    params.append('amount', amount.toFixed(2));
  }

  if (note) {
    params.append('note', note);
  }

  // PayPal.me link format (more universal)
  if (email && amount > 0) {
    const username = email.split('@')[0];
    return `https://paypal.me/${username}/${amount.toFixed(2)}`;
  }

  return `paypal://paymentreview?${params.toString()}`;
}

/**
 * Generate a Cash App deep link
 * @param amount - Payment amount
 * @param note - Payment note/description
 * @param cashtag - Recipient's $cashtag (without $)
 * @returns Cash App deep link URL
 */
export function getCashAppDeepLink(
  amount: number,
  note?: string,
  cashtag?: string
): string {
  const params = new URLSearchParams();

  if (cashtag) {
    const cleanCashtag = cashtag.replace('$', '');
    params.append('recipient', cleanCashtag);
  }

  if (amount > 0) {
    params.append('amount', amount.toFixed(2));
  }

  if (note) {
    params.append('note', note);
  }

  return `cashapp://cash.app/pay?${params.toString()}`;
}

/**
 * Generate a Zelle deep link (limited functionality)
 * Zelle doesn't have robust deep linking, so this opens the app
 * @param amount - Payment amount
 * @param note - Payment note/description
 * @param phone - Recipient's phone number
 * @param email - Recipient's email
 * @returns Zelle deep link URL
 */
export function getZelleDeepLink(
  amount: number,
  note?: string,
  phone?: string,
  email?: string
): string {
  // Zelle has limited deep linking support
  // Most banks implement their own Zelle integration
  // This is a best-effort approach
  const params = new URLSearchParams();

  if (amount > 0) {
    params.append('amount', amount.toFixed(2));
  }

  if (note) {
    params.append('memo', note);
  }

  if (phone) {
    params.append('token', phone);
  } else if (email) {
    params.append('token', email);
  }

  return `zelle://send?${params.toString()}`;
}

/**
 * Open a payment app with pre-filled information
 * @param app - Payment app to open
 * @param params - Payment parameters
 * @returns Object with opened status and timestamp for confirmation tracking
 */
export async function openPaymentApp(
  app: PaymentApp,
  params: PaymentLinkParams
): Promise<{ opened: boolean; timestamp: number; deepLink: string }> {
  let deepLink: string;
  let appName: string;
  const timestamp = Date.now();

  switch (app) {
    case 'venmo':
      deepLink = getVenmoDeepLink(params.amount, params.note, params.recipient, params.txnType);
      appName = 'Venmo';
      break;
    case 'paypal':
      deepLink = getPayPalDeepLink(params.amount, params.note, params.email);
      appName = 'PayPal';
      break;
    case 'cashapp':
      deepLink = getCashAppDeepLink(params.amount, params.note, params.cashtag);
      appName = 'Cash App';
      break;
    case 'zelle':
      deepLink = getZelleDeepLink(params.amount, params.note, params.phone, params.email);
      appName = 'Zelle';
      break;
    default:
      Alert.alert('Error', 'Unsupported payment app');
      return { opened: false, timestamp, deepLink: '' };
  }

  try {
    const canOpen = await Linking.canOpenURL(deepLink);

    if (canOpen) {
      await Linking.openURL(deepLink);
      return { opened: true, timestamp, deepLink };
    } else {
      // App not installed, show instructions
      Alert.alert(
        `${appName} Not Installed`,
        `Please install ${appName} to use this feature, or choose a different payment method.`,
        [
          { text: 'OK', style: 'default' },
        ]
      );
      return { opened: false, timestamp, deepLink };
    }
  } catch (error) {
    console.error(`Error opening ${appName}:`, error);
    Alert.alert(
      'Error',
      `Could not open ${appName}. Please make sure it's installed.`
    );
    return { opened: false, timestamp, deepLink };
  }
}

/**
 * Open Venmo to request money from someone
 * @param params - Payment request parameters
 * @returns Object with opened status and timestamp
 */
export async function openVenmoRequest(
  params: Omit<PaymentLinkParams, 'txnType'>
): Promise<{ opened: boolean; timestamp: number; deepLink: string }> {
  return openPaymentApp('venmo', { ...params, txnType: 'charge' });
}

/**
 * Get a user-friendly payment app name
 */
export function getPaymentAppName(app: PaymentApp): string {
  switch (app) {
    case 'venmo':
      return 'Venmo';
    case 'paypal':
      return 'PayPal';
    case 'cashapp':
      return 'Cash App';
    case 'zelle':
      return 'Zelle';
    default:
      return 'Payment App';
  }
}

/**
 * Get a payment app icon (emoji)
 */
export function getPaymentAppIcon(app: PaymentApp): string {
  switch (app) {
    case 'venmo':
      return '💙'; // Venmo blue
    case 'paypal':
      return '💰'; // PayPal
    case 'cashapp':
      return '💚'; // Cash App green
    case 'zelle':
      return '⚡'; // Zelle (fast)
    default:
      return '💳';
  }
}

// ============================================
// QR Code Generation
// ============================================

/**
 * Generate a Venmo QR code URL for in-person payments
 * This URL can be encoded into a QR code that opens Venmo when scanned
 * @param username - Venmo username
 * @param amount - Payment amount
 * @param note - Payment note
 * @returns URL suitable for QR code generation
 */
export function getVenmoQRCodeUrl(
  username: string,
  amount: number,
  note?: string
): string {
  const params = new URLSearchParams();
  params.append('txn', 'pay');
  params.append('recipients', username);
  if (amount > 0) {
    params.append('amount', amount.toFixed(2));
  }
  if (note) {
    params.append('note', note);
  }
  return `https://venmo.com/paycharge?${params.toString()}`;
}

/**
 * Generate a PayPal QR code URL
 * @param username - PayPal.me username
 * @param amount - Payment amount
 * @returns PayPal.me URL suitable for QR code
 */
export function getPayPalQRCodeUrl(
  username: string,
  amount: number
): string {
  return `https://paypal.me/${username}/${amount.toFixed(2)}`;
}

/**
 * Generate a Cash App QR code URL
 * @param cashtag - Cash App $cashtag
 * @param amount - Payment amount
 * @returns Cash App URL suitable for QR code
 */
export function getCashAppQRCodeUrl(
  cashtag: string,
  amount: number
): string {
  const cleanCashtag = cashtag.replace('$', '');
  return `https://cash.app/$${cleanCashtag}/${amount.toFixed(2)}`;
}

/**
 * QR code data for a settlement
 */
export interface SettlementQRCode {
  app: PaymentApp;
  url: string;
  displayName: string;
}

/**
 * Generate all available QR code URLs for a settlement
 * @param amount - Settlement amount
 * @param recipientInfo - Payment info for the recipient
 * @param note - Payment note
 * @returns Array of QR code data for available payment methods
 */
export function generateSettlementQRCodes(
  amount: number,
  recipientInfo: {
    venmoUsername?: string;
    paypalUsername?: string;
    cashAppTag?: string;
  },
  note?: string
): SettlementQRCode[] {
  const qrCodes: SettlementQRCode[] = [];

  if (recipientInfo.venmoUsername) {
    qrCodes.push({
      app: 'venmo',
      url: getVenmoQRCodeUrl(recipientInfo.venmoUsername, amount, note),
      displayName: 'Venmo',
    });
  }

  if (recipientInfo.paypalUsername) {
    qrCodes.push({
      app: 'paypal',
      url: getPayPalQRCodeUrl(recipientInfo.paypalUsername, amount),
      displayName: 'PayPal',
    });
  }

  if (recipientInfo.cashAppTag) {
    qrCodes.push({
      app: 'cashapp',
      url: getCashAppQRCodeUrl(recipientInfo.cashAppTag, amount),
      displayName: 'Cash App',
    });
  }

  return qrCodes;
}

// ============================================
// Payment App Availability Detection
// ============================================

/**
 * Check if a payment app is installed on the device
 * @param app - Payment app to check
 * @returns True if the app is installed
 */
export async function isPaymentAppInstalled(app: PaymentApp): Promise<boolean> {
  const testUrls: Record<PaymentApp, string> = {
    venmo: 'venmo://',
    paypal: 'paypal://',
    cashapp: 'cashapp://',
    zelle: 'zelle://',
  };

  try {
    return await Linking.canOpenURL(testUrls[app]);
  } catch {
    return false;
  }
}

/**
 * Get list of installed payment apps
 * @returns Array of installed payment app identifiers
 */
export async function getInstalledPaymentApps(): Promise<PaymentApp[]> {
  const apps: PaymentApp[] = ['venmo', 'paypal', 'cashapp', 'zelle'];
  const installed: PaymentApp[] = [];

  for (const app of apps) {
    if (await isPaymentAppInstalled(app)) {
      installed.push(app);
    }
  }

  return installed;
}

// ============================================
// Multi-App Settlement Suggestions
// ============================================

/**
 * User's linked payment accounts
 */
export interface UserPaymentAccounts {
  venmoUsername?: string | null;
  paypalUsername?: string | null;
  cashAppTag?: string | null;
  zelleEmail?: string | null;
  zellePhone?: string | null;
}

/**
 * Payment suggestion with match status
 */
export interface PaymentSuggestion {
  app: PaymentApp;
  displayName: string;
  icon: string;
  /** Both sender and recipient have this payment method linked */
  bothLinked: boolean;
  /** The recipient has this payment method linked */
  recipientLinked: boolean;
  /** The sender has this payment method linked */
  senderLinked: boolean;
  /** App is installed on the device */
  appInstalled: boolean;
  /** Recipient's username/tag for this payment method */
  recipientHandle?: string;
  /** Priority score for sorting (higher = better) */
  priority: number;
}

/**
 * Calculate payment suggestion priority
 */
function calculatePriority(
  bothLinked: boolean,
  recipientLinked: boolean,
  appInstalled: boolean
): number {
  let priority = 0;
  if (bothLinked) priority += 100;
  if (recipientLinked) priority += 50;
  if (appInstalled) priority += 25;
  return priority;
}

/**
 * Get payment suggestions sorted by best match
 * Shows which payment apps both parties have linked
 * @param senderAccounts - Sender's linked payment accounts
 * @param recipientAccounts - Recipient's linked payment accounts
 * @param installedApps - List of installed payment apps (optional, will be fetched if not provided)
 * @returns Sorted array of payment suggestions
 */
export async function getPaymentSuggestions(
  senderAccounts: UserPaymentAccounts,
  recipientAccounts: UserPaymentAccounts,
  installedApps?: PaymentApp[]
): Promise<PaymentSuggestion[]> {
  const installed = installedApps ?? await getInstalledPaymentApps();
  const installedSet = new Set(installed);

  const suggestions: PaymentSuggestion[] = [];

  // Venmo
  const venmoSender = !!senderAccounts.venmoUsername;
  const venmoRecipient = !!recipientAccounts.venmoUsername;
  const venmoInstalled = installedSet.has('venmo');
  suggestions.push({
    app: 'venmo',
    displayName: 'Venmo',
    icon: getPaymentAppIcon('venmo'),
    bothLinked: venmoSender && venmoRecipient,
    recipientLinked: venmoRecipient,
    senderLinked: venmoSender,
    appInstalled: venmoInstalled,
    recipientHandle: recipientAccounts.venmoUsername || undefined,
    priority: calculatePriority(venmoSender && venmoRecipient, venmoRecipient, venmoInstalled),
  });

  // PayPal
  const paypalSender = !!senderAccounts.paypalUsername;
  const paypalRecipient = !!recipientAccounts.paypalUsername;
  const paypalInstalled = installedSet.has('paypal');
  suggestions.push({
    app: 'paypal',
    displayName: 'PayPal',
    icon: getPaymentAppIcon('paypal'),
    bothLinked: paypalSender && paypalRecipient,
    recipientLinked: paypalRecipient,
    senderLinked: paypalSender,
    appInstalled: paypalInstalled,
    recipientHandle: recipientAccounts.paypalUsername || undefined,
    priority: calculatePriority(paypalSender && paypalRecipient, paypalRecipient, paypalInstalled),
  });

  // Cash App
  const cashappSender = !!senderAccounts.cashAppTag;
  const cashappRecipient = !!recipientAccounts.cashAppTag;
  const cashappInstalled = installedSet.has('cashapp');
  suggestions.push({
    app: 'cashapp',
    displayName: 'Cash App',
    icon: getPaymentAppIcon('cashapp'),
    bothLinked: cashappSender && cashappRecipient,
    recipientLinked: cashappRecipient,
    senderLinked: cashappSender,
    appInstalled: cashappInstalled,
    recipientHandle: recipientAccounts.cashAppTag || undefined,
    priority: calculatePriority(cashappSender && cashappRecipient, cashappRecipient, cashappInstalled),
  });

  // Zelle
  const zelleSender = !!(senderAccounts.zelleEmail || senderAccounts.zellePhone);
  const zelleRecipient = !!(recipientAccounts.zelleEmail || recipientAccounts.zellePhone);
  const zelleInstalled = installedSet.has('zelle');
  suggestions.push({
    app: 'zelle',
    displayName: 'Zelle',
    icon: getPaymentAppIcon('zelle'),
    bothLinked: zelleSender && zelleRecipient,
    recipientLinked: zelleRecipient,
    senderLinked: zelleSender,
    appInstalled: zelleInstalled,
    recipientHandle: recipientAccounts.zelleEmail || recipientAccounts.zellePhone || undefined,
    priority: calculatePriority(zelleSender && zelleRecipient, zelleRecipient, zelleInstalled),
  });

  // Sort by priority (highest first)
  suggestions.sort((a, b) => b.priority - a.priority);

  return suggestions;
}

/**
 * Get the best payment suggestion (highest priority)
 */
export async function getBestPaymentSuggestion(
  senderAccounts: UserPaymentAccounts,
  recipientAccounts: UserPaymentAccounts
): Promise<PaymentSuggestion | null> {
  const suggestions = await getPaymentSuggestions(senderAccounts, recipientAccounts);
  return suggestions.length > 0 ? suggestions[0] : null;
}

// ============================================
// Payment Confirmation Tracking
// ============================================

/**
 * Pending payment session for tracking confirmation
 */
export interface PendingPaymentSession {
  id: string;
  app: PaymentApp;
  amount: number;
  recipientId: string;
  recipientName: string;
  groupId: string;
  note: string;
  deepLink: string;
  openedAt: number;
  /** Has the user returned to the app? */
  returned: boolean;
  /** Has the user confirmed the payment? */
  confirmed: boolean;
  /** When the user returned to the app */
  returnedAt?: number;
}

/**
 * Create a new pending payment session
 */
export function createPendingPaymentSession(
  app: PaymentApp,
  amount: number,
  recipientId: string,
  recipientName: string,
  groupId: string,
  note: string,
  deepLink: string
): PendingPaymentSession {
  return {
    id: `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    app,
    amount,
    recipientId,
    recipientName,
    groupId,
    note,
    deepLink,
    openedAt: Date.now(),
    returned: false,
    confirmed: false,
  };
}

/**
 * Check if enough time has passed for a reasonable payment (at least 3 seconds)
 */
export function isReasonablePaymentDuration(session: PendingPaymentSession): boolean {
  const MIN_PAYMENT_DURATION_MS = 3000; // 3 seconds minimum
  const now = Date.now();
  return (now - session.openedAt) >= MIN_PAYMENT_DURATION_MS;
}

/**
 * Format time since payment app was opened
 */
export function formatTimeSinceOpened(session: PendingPaymentSession): string {
  const seconds = Math.floor((Date.now() - session.openedAt) / 1000);

  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
}

// ============================================
// Venmo Profile Deep Links
// ============================================

/**
 * Open a Venmo user's profile
 * @param username - Venmo username (without @)
 * @returns True if opened successfully
 */
export async function openVenmoProfile(username: string): Promise<boolean> {
  const cleanUsername = username.replace(/^@/, '');
  const venmoProfileUrl = `venmo://users?username=${cleanUsername}`;
  const webFallbackUrl = `https://venmo.com/${cleanUsername}`;

  try {
    const canOpen = await Linking.canOpenURL(venmoProfileUrl);
    if (canOpen) {
      await Linking.openURL(venmoProfileUrl);
      return true;
    } else {
      // Fallback to web
      await Linking.openURL(webFallbackUrl);
      return true;
    }
  } catch (error) {
    // Try web fallback
    try {
      await Linking.openURL(webFallbackUrl);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get the Venmo profile URL (web) for a username
 */
export function getVenmoProfileUrl(username: string): string {
  const cleanUsername = username.replace(/^@/, '');
  return `https://venmo.com/${cleanUsername}`;
}

/**
 * Get the Venmo profile deep link for a username
 */
export function getVenmoProfileDeepLink(username: string): string {
  const cleanUsername = username.replace(/^@/, '');
  return `venmo://users?username=${cleanUsername}`;
}
