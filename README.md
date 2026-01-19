# split it.

A 100% free expense-splitting mobile app. Split bills with friends, roommates, and travel companions without limits or paywalls.

## Features

- Create and manage expense groups
- Track shared expenses with customizable splits
- Receipt scanning with AI-powered item extraction
- Real-time balance calculations
- Debt simplification (minimize transactions)
- Group sharing via invite codes and QR codes
- Push notifications for reminders
- Recurring expense support
- Export data to CSV/PDF

## Tech Stack

- **Framework**: React Native + Expo (SDK 54)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Auth**: Clerk
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator or Android Emulator (or Expo Go app)

### Installation

```bash
# Clone the repository
git clone https://github.com/sebrusso/split.git
cd split/splitfree

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your Supabase and Clerk credentials

# Start development server
npm start
```

### Running the App

```bash
npm start        # Start Expo dev server
npm run ios      # Run on iOS simulator
npm run android  # Run on Android emulator
```

## Development

```bash
npm test              # Run all tests
npm run typecheck     # TypeScript type checking
npm run test:coverage # Run tests with coverage
```

## Documentation

Additional documentation is available in the `docs/` folder:

- [Design Doc](docs/DESIGN_DOC.md) - Architecture and design decisions
- [Product Requirements](docs/PRODUCT_REQUIREMENTS.md) - Feature roadmap
- [Security Review](docs/SECURITY_REVIEW.md) - Security audit findings
- [Store Listing](docs/STORE_LISTING.md) - App Store submission content

## Project Structure

```
splitfree/
├── app/                 # Expo Router screens
├── components/ui/       # Reusable UI components
├── lib/                 # Core utilities and hooks
├── __tests__/           # Jest test files
├── assets/              # Images and splash screens
├── docs/                # Documentation
├── scripts/             # Development scripts
└── supabase/            # Database migrations
```

## License

UNLICENSED - Private repository
