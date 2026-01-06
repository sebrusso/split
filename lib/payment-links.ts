/**
 * Payment App Deep Links
 *
 * Utilities for generating deep links to popular payment apps
 * to pre-fill payment screens with amount and note.
 */

import { Linking, Alert, Platform } from 'react-native';

export type PaymentApp = 'venmo' | 'paypal' | 'cashapp' | 'zelle';

interface PaymentLinkParams {
  amount: number;
  note?: string;
  recipient?: string;
  email?: string;
  phone?: string;
  cashtag?: string;
}

/**
 * Generate a Venmo deep link
 * @param amount - Payment amount
 * @param note - Payment note/description
 * @param recipient - Venmo username (without @)
 * @returns Venmo deep link URL
 */
export function getVenmoDeepLink(
  amount: number,
  note?: string,
  recipient?: string
): string {
  const params = new URLSearchParams();

  if (recipient) {
    params.append('txn', 'pay');
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
 */
export async function openPaymentApp(
  app: PaymentApp,
  params: PaymentLinkParams
): Promise<void> {
  let deepLink: string;
  let appName: string;

  switch (app) {
    case 'venmo':
      deepLink = getVenmoDeepLink(params.amount, params.note, params.recipient);
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
      return;
  }

  try {
    const canOpen = await Linking.canOpenURL(deepLink);

    if (canOpen) {
      await Linking.openURL(deepLink);
    } else {
      // App not installed, show instructions
      Alert.alert(
        `${appName} Not Installed`,
        `Please install ${appName} to use this feature, or choose a different payment method.`,
        [
          { text: 'OK', style: 'default' },
        ]
      );
    }
  } catch (error) {
    console.error(`Error opening ${appName}:`, error);
    Alert.alert(
      'Error',
      `Could not open ${appName}. Please make sure it's installed.`
    );
  }
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
