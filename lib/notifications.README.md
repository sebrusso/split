# Push Notification Infrastructure

This document describes the push notification infrastructure for split it..

## Overview

The notification system is built on top of Expo's push notification service. It provides:

1. **Permission Management**: Request and check notification permissions
2. **Token Registration**: Register device push tokens with the backend
3. **Notification Handlers**: Configure how notifications are displayed
4. **Helper Functions**: Create notification payloads for different events
5. **Local Notifications**: Schedule local notifications for testing/reminders

## Setup

### 1. Installation

The required packages are already installed:
- `expo-notifications` - Expo's notification library
- `expo-device` - Device detection (for physical device check)

### 2. Configuration

The app is configured in `app.json`:
```json
{
  "plugins": [
    ["expo-notifications", {
      "icon": "./assets/icon.png",
      "color": "#10B981",
      "sounds": [],
      "mode": "production"
    }]
  ]
}
```

### 3. Database Migration

Run the migration to create the `push_tokens` table:

```bash
# Apply the migration to your Supabase database
supabase db push supabase/migrations/create_push_tokens_table.sql
```

Or manually run the SQL in the Supabase dashboard.

## Usage

### Requesting Permissions

```typescript
import { requestNotificationPermissions } from '../lib/notifications';

// Simple permission request
const granted = await requestNotificationPermissions();
if (granted) {
  console.log('Notification permissions granted');
}
```

### Registering Push Tokens

Push tokens are automatically registered when a user signs in (handled in `app/_layout.tsx`).

To manually register:

```typescript
import { registerPushToken } from '../lib/notifications';

const token = await registerPushToken(userId);
if (token) {
  console.log('Push token registered:', token);
}
```

### Creating Notification Payloads

Use the helper functions to create notification payloads:

```typescript
import {
  createExpenseNotification,
  createSettlementNotification,
  createMemberJoinedNotification,
} from '../lib/notifications';

// New expense notification
const expensePayload = createExpenseNotification(
  'Vacation Group',
  'Dinner at restaurant',
  45.50
);

// Settlement notification
const settlementPayload = createSettlementNotification(
  'Vacation Group',
  'John',
  25.00
);

// Member joined notification
const memberPayload = createMemberJoinedNotification(
  'Sarah',
  'Vacation Group'
);
```

### Scheduling Local Notifications

For testing or reminder features:

```typescript
import { scheduleLocalNotification } from '../lib/notifications';

// Schedule notification 10 seconds from now
const id = await scheduleLocalNotification(
  'Reminder',
  'Don\'t forget to settle up!',
  10 // seconds
);

// Schedule notification at specific time
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const id2 = await scheduleLocalNotification(
  'Daily Reminder',
  'Check your balances',
  tomorrow
);
```

### Listening to Notifications

```typescript
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from '../lib/notifications';

// Listen for notifications while app is open
const removeReceivedListener = addNotificationReceivedListener((payload) => {
  console.log('Notification received:', payload);
  // Handle notification (update UI, etc.)
});

// Listen for user tapping notifications
const removeResponseListener = addNotificationResponseListener((payload) => {
  console.log('Notification tapped:', payload);
  // Navigate to relevant screen based on payload.type
  if (payload.type === 'expense_added') {
    // Navigate to group/expense
  }
});

// Clean up when component unmounts
useEffect(() => {
  return () => {
    removeReceivedListener();
    removeResponseListener();
  };
}, []);
```

## Notification Types

The following notification types are supported:

| Type | Description | Use Case |
|------|-------------|----------|
| `expense_added` | New expense added to group | Notify members when someone adds an expense |
| `settlement_recorded` | Payment recorded | Notify member when someone settles up with them |
| `member_joined` | New member joined group | Notify existing members when someone joins |
| `friend_request` | New friend request | Social feature notifications |
| `friend_accepted` | Friend request accepted | Social feature notifications |
| `group_invite` | Group invitation | Notify user they've been invited to a group |

## Sending Push Notifications

**Important**: This client-side infrastructure only handles receiving notifications. To actually send push notifications, you need a backend service (Supabase Edge Function, AWS Lambda, etc.).

### Backend Implementation Options

#### Option 1: Supabase Edge Functions

Create a Supabase Edge Function that:
1. Listens to database changes (expenses, settlements, etc.)
2. Queries the `push_tokens` table for affected users
3. Sends push notifications via Expo's Push Notification API

#### Option 2: Supabase Database Triggers

Use PostgreSQL triggers to call a webhook that sends notifications.

### Example: Sending via Expo's API

```typescript
// Backend code (not included in client)
import fetch from 'node-fetch';

async function sendPushNotification(expoPushToken: string, payload: NotificationPayload) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data,
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}
```

## Testing

### On Physical Device

1. Build a development or production build (push notifications don't work in Expo Go)
2. Sign in to the app
3. Grant notification permissions when prompted
4. Check console logs to verify token registration
5. Use the local notification scheduler to test notification display

### Testing Local Notifications

Add this to any screen for quick testing:

```typescript
import { scheduleLocalNotification } from '../lib/notifications';

// In your component
<Button
  title="Test Notification"
  onPress={async () => {
    await scheduleLocalNotification(
      'Test',
      'This is a test notification',
      5 // 5 seconds
    );
  }}
/>
```

## Database Schema

The `push_tokens` table stores device tokens:

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,           -- Clerk user ID
  token TEXT NOT NULL UNIQUE,      -- Expo push token
  platform TEXT NOT NULL,          -- 'ios', 'android', or 'web'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Limitations

1. **Physical Device Required**: Push notifications only work on real devices, not simulators/emulators
2. **Backend Service Needed**: This implementation provides client-side infrastructure only
3. **Expo Limitations**: Must use Expo's push notification service (can't use FCM/APNs directly)
4. **Rate Limits**: Expo has rate limits on push notifications (check their docs)

## Next Steps

To complete the push notification system:

1. **Create Supabase Edge Function**: Implement backend logic to send notifications
2. **Add Triggers**: Set up database triggers for expense/settlement events
3. **Test on Real Devices**: Test with physical iOS and Android devices
4. **Add Deep Linking**: Navigate to relevant screens when notifications are tapped
5. **Add Notification Settings**: Let users control which notifications they receive

## Resources

- [Expo Push Notifications Docs](https://docs.expo.dev/push-notifications/overview/)
- [Expo Push Token API](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
