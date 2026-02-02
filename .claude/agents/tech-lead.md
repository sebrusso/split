---
name: tech-lead
description: "any time youre implementing new product features"
model: opus
color: red
---

---                                                                                      
  Project Overview                                                                         
                                                                                           
  split it. is a 100% free, ad-supported expense-splitting mobile app (Splitwise           
  alternative). Built for iOS, Android, and web with a focus on multiplayer group expense  
  management.                                                                              
                                                                                           
  Key Value Proposition: No paywalls, no transaction limits, full-featured expense         
  splitting with receipt scanning, Venmo integration, and real-time sync.                  
                                                                                           
  ---                                                                                      
  Tech Stack                                                                               
                                                                                           
  Frontend                                                                                 
  ┌──────────────┬─────────┬──────────────────────────────────────┐                        
  │  Technology  │ Version │               Purpose                │                        
  ├──────────────┼─────────┼──────────────────────────────────────┤                        
  │ React Native │ 0.81.5  │ Cross-platform mobile framework      │                        
  ├──────────────┼─────────┼──────────────────────────────────────┤                        
  │ Expo         │ SDK 54  │ Development platform & build service │                        
  ├──────────────┼─────────┼──────────────────────────────────────┤                        
  │ Expo Router  │ 6.x     │ File-based navigation (like Next.js) │                        
  ├──────────────┼─────────┼──────────────────────────────────────┤                        
  │ TypeScript   │ 5.9     │ Type safety                          │                        
  ├──────────────┼─────────┼──────────────────────────────────────┤                        
  │ React        │ 19.1    │ UI library                           │                        
  └──────────────┴─────────┴──────────────────────────────────────┘                        
  Backend & Services                                                                       
  Service: Supabase                                                                        
  Purpose: PostgreSQL database + Auth + Realtime + Storage                                 
  Dashboard: supabase.com/dashboard                                                        
  ────────────────────────────────────────                                                 
  Service: Clerk                                                                           
  Purpose: User authentication (sign-up, sign-in, OAuth)                                   
  Dashboard: dashboard.clerk.com                                                           
  ────────────────────────────────────────                                                 
  Service: Sentry                                                                          
  Purpose: Error monitoring & crash reporting                                              
  Dashboard: sentry.io                                                                     
  ────────────────────────────────────────                                                 
  Service: PostHog                                                                         
  Purpose: Product analytics & event tracking                                              
  Dashboard: app.posthog.com                                                               
  ────────────────────────────────────────                                                 
  Service: EAS                                                                             
  Purpose: Expo Application Services (builds, updates, submit)                             
  Dashboard: expo.dev                                                                      
  Key Libraries                                                                            
                                                                                           
  @clerk/clerk-expo      - Authentication                                                  
  @supabase/supabase-js  - Database client                                                 
  @sentry/react-native   - Error tracking                                                  
  posthog-react-native   - Analytics                                                       
  expo-camera            - Camera for QR/receipt scanning                                  
  expo-notifications     - Push notifications                                              
  react-native-qrcode-svg - QR code generation                                             
                                                                                           
  ---                                                                                      
  Project Structure                                                                        
                                                                                           
  splitfree/                                                                               
  ├── app/                           # Screens (Expo Router file-based)                    
  │   ├── _layout.tsx               # Root layout + auth guard + providers                 
  │   ├── index.tsx                 # Redirect to (tabs)                                   
  │   ├── (tabs)/                   # Tab navigator screens                                
  │   │   ├── _layout.tsx           # Tab configuration                                    
  │   │   ├── index.tsx             # Home - Groups list                                   
  │   │   ├── scan.tsx              # Receipt/QR scanner                                   
  │   │   ├── balances.tsx          # Global balances                                      
  │   │   ├── activity.tsx          # Activity feed                                        
  │   │   └── profile.tsx           # User profile                                         
  │   ├── auth/                     # Authentication flows                                 
  │   │   ├── welcome.tsx           # Onboarding carousel                                  
  │   │   ├── sign-in.tsx           # Login                                                
  │   │   ├── sign-up.tsx           # Registration                                         
  │   │   └── forgot-password.tsx   # Password reset                                       
  │   ├── group/[id]/               # Dynamic group routes                                 
  │   │   ├── index.tsx             # Group detail                                         
  │   │   ├── balances.tsx          # Who owes whom                                        
  │   │   ├── add-expense.tsx       # Create expense                                       
  │   │   ├── share.tsx             # Share/QR code                                        
  │   │   └── ...                                                                          
  │   ├── join/                     # Join group flow                                      
  │   │   └── index.tsx             # Enter code or deep link                              
  │   └── friends/                  # Friend system                                        
  │       ├── index.tsx             # Friends list                                         
  │       ├── add.tsx               # Search & add                                         
  │       └── requests.tsx          # Pending requests                                     
  ├── components/                                                                          
  │   └── ui/                       # Reusable UI components                               
  │       ├── Button.tsx                                                                   
  │       ├── Card.tsx                                                                     
  │       ├── Input.tsx                                                                    
  │       ├── Avatar.tsx                                                                   
  │       ├── QRCodeScanner.tsx     # QR code scanner                                      
  │       └── index.ts              # Barrel export                                        
  ├── lib/                          # Core business logic                                  
  │   ├── supabase.ts              # Supabase client + auth hook                           
  │   ├── clerk.ts                 # Clerk configuration                                   
  │   ├── auth-context.tsx         # Auth React context                                    
  │   ├── types.ts                 # TypeScript interfaces                                 
  │   ├── utils.ts                 # Balance calc, formatting                              
  │   ├── friends.ts               # Friend operations                                     
  │   ├── notifications.ts         # Push notification helpers                             
  │   ├── payment-links.ts         # Venmo/PayPal deep links                               
  │   ├── sync.ts                  # Background sync logic                                 
  │   ├── result.ts                # Result<T> type for error handling                     
  │   ├── analytics.ts             # PostHog helpers                                       
  │   ├── sentry.ts                # Sentry configuration                                  
  │   ├── logger.ts                # Logging abstraction                                   
  │   └── theme.ts                 # Colors, typography, spacing                           
  ├── supabase/                                                                            
  │   └── migrations/              # SQL migration files                                   
  ├── __tests__/                   # Jest tests                                            
  │   ├── helpers/                 # Test utilities                                        
  │   ├── utils.test.ts            # Unit tests                                            
  │   └── *.integration.test.ts    # Integration tests                                     
  ├── assets/                      # Images, icons, splash                                 
  ├── app.json                     # Expo configuration                                    
  ├── eas.json                     # EAS Build profiles                                    
  ├── package.json                 # Dependencies                                          
  └── tsconfig.json                # TypeScript config                                     
                                                                                           
  ---                                                                                      
  Environment Configuration                                                                
                                                                                           
  Required Environment Variables                                                           
                                                                                           
  Create .env.local from .env.example:                                                     
                                                                                           
  # Supabase (Required)
  EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>                                                
                                                                                           
  # Clerk Authentication (Required)                                                        
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...                                            
  EXPO_PUBLIC_OAUTH_REDIRECT_URL=splitfree://oauth-callback                                
                                                                                           
  # Gemini API for Receipt OCR (Optional)                                                  
  EXPO_PUBLIC_GEMINI_API_KEY=...                                                           
                                                                                           
  # PostHog Analytics (Optional)                                                           
  EXPO_PUBLIC_POSTHOG_API_KEY=...                                                          
  EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com                                         
                                                                                           
  # Sentry (Optional but recommended)                                                      
  EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...                                         
                                                                                           
  Environment Differences                                                                  
  ┌─────────────────┬─────────────┬─────────────┬────────────┐                             
  │     Feature     │ Development │   Preview   │ Production │                             
  ├─────────────────┼─────────────┼─────────────┼────────────┤                             
  │ __DEV__ flag    │ true        │ false       │ false      │                             
  ├─────────────────┼─────────────┼─────────────┼────────────┤                             
  │ Sentry sampling │ 100% traces │ 100% traces │ 20% traces │                             
  ├─────────────────┼─────────────┼─────────────┼────────────┤                             
  │ Console logs    │ Visible     │ Visible     │ Filtered   │                             
  ├─────────────────┼─────────────┼─────────────┼────────────┤                             
  │ Clerk instance  │ Test        │ Production  │ Production │                             
  ├─────────────────┼─────────────┼─────────────┼────────────┤                             
  │ EAS channel     │ N/A         │ preview     │ production │                             
  └─────────────────┴─────────────┴─────────────┴────────────┘                             
  EAS Build Profiles (eas.json)

  # Development (Expo Go compatible)
  npm start

  # Simulator build with prod env
  eas build --profile simulator-release --platform ios

  # TestFlight beta
  eas build --profile testflight --platform ios
  eas submit --profile testflight --platform ios

  # Production release
  eas build --profile production --platform all

  ---
  Database Environments (Supabase Branching)

  Architecture Overview
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │  Git Branch: main          │   Git Branch: staging                                  │
  │  ───────────────────────   │   ────────────────────                                 │
  │  Supabase: PRODUCTION      │   Supabase: STAGING BRANCH                             │
  │  Project: <PROD_REF>            │   Project: <STAGING_REF>                         │
  │  Clerk: Production (pk_live)    │   Clerk: Development (pk_test)                   │
  │  EAS Env: production       │   EAS Env: development                                 │
  │  Build: testflight, production │   Build: development, preview                      │
  └─────────────────────────────────────────────────────────────────────────────────────┘

  Environment Mapping
  ┌──────────────────┬──────────────────────────────┬──────────────────────────────────┐
  │    Build Type    │      Supabase Project        │         Clerk Instance           │
  ├──────────────────┼──────────────────────────────┼──────────────────────────────────┤
  │ Expo Go / Dev    │ Staging (<STAGING_REF>)        │ Development (pk_test_...)      │
  ├──────────────────┼──────────────────────────────┼──────────────────────────────────┤
  │ Preview          │ Staging (<STAGING_REF>)        │ Development (pk_test_...)      │
  ├──────────────────┼──────────────────────────────┼──────────────────────────────────┤
  │ TestFlight       │ Production (<PROD_REF>)        │ Production (pk_live_...)       │
  ├──────────────────┼──────────────────────────────┼──────────────────────────────────┤
  │ Production       │ Production (<PROD_REF>)        │ Production (pk_live_...)       │
  └──────────────────┴──────────────────────────────┴──────────────────────────────────┘

  Key Files
  - supabase/config.toml      - Branch refs, seeding config
  - supabase/seed.sql         - Test data (5 groups, 16 members, 17 expenses)
  - supabase/migrations/      - Schema migrations (applied on branch creation)
  - .env.local                - Local dev uses STAGING credentials

  Database Commands
  # Seed staging database (via pg client script)
  node scripts/apply-baseline.js

  # Create new migration
  npx supabase migration new <migration_name>

  # Push migrations to staging (Supabase CLI)
  npx supabase db push --linked

  # View migration history
  npx supabase migration list --linked

  Clerk Third-Party Auth Configuration
  - Staging: Clerk Dev instance → Supabase staging branch
    Domain: promoted-rattler-76.clerk.accounts.dev
  - Production: Clerk Prod instance → Supabase main branch
    Domain: clerk.split-it.net

  ---
  Database Workflow Best Practices

  THE GOLDEN RULE
  ───────────────────────────────────────────────────────────────────────────────
  Your `supabase/migrations/` folder is the single source of truth.
  If a schema change isn't in a migration file, it shouldn't exist in
  staging or production.
  ───────────────────────────────────────────────────────────────────────────────

  Required Workflow for Any Schema Change

  1. CREATE MIGRATION FILE FIRST
     npx supabase migration new <descriptive_name>

  2. WRITE SQL in supabase/migrations/YYYYMMDDHHMMSS_<name>.sql
     Include constraints, indexes, RLS policies in the same migration

  3. TEST LOCALLY
     npx supabase db reset

  4. DEPLOY TO STAGING
     npx supabase link --project-ref <STAGING_REF>
     npx supabase db push

  5. RUN INTEGRATION TESTS
     npm run test:integration

  6. DEPLOY TO PRODUCTION (only after staging verification)
     npx supabase link --project-ref <PROD_REF>
     npx supabase db push

  MCP vs CLI Usage
  ┌─────────────────────────────────────┬────────────────────────────────────────┐
  │         Use MCP Tools For           │           Use CLI For                  │
  ├─────────────────────────────────────┼────────────────────────────────────────┤
  │ Read-only queries on production     │ Creating new migrations                │
  │ Listing tables/migrations           │ Deploying to staging                   │
  │ Security/performance advisors       │ Testing migrations locally             │
  │ Production migrations (after        │ Switching between environments         │
  │   staging verification)             │                                        │
  └─────────────────────────────────────┴────────────────────────────────────────┘

  IMPORTANT: Supabase MCP connects to PRODUCTION by default.
  For staging operations, use CLI with --project-ref <STAGING_REF>

  What NOT to Do
  ┌────────────────────────────────────┬────────────────────────────────────────┐
  │           Never Do This            │              Do This Instead           │
  ├────────────────────────────────────┼────────────────────────────────────────┤
  │ Edit schema in Supabase Dashboard  │ Create migration file first            │
  │ Apply SQL without migration file   │ Write SQL in migration file            │
  │ Use MCP for staging changes        │ Use CLI with staging ref               │
  │ Skip staging verification          │ Always test on staging first           │
  │ Modify existing migration files    │ Create new migration                   │
  └────────────────────────────────────┴────────────────────────────────────────┘

  Staging/Production Parity Issues

  If tests pass on production but fail on staging with constraint errors:
  1. Compare schema objects between environments
  2. Clean up violating data in staging
  3. Apply missing objects directly via SQL
  4. Create migration file for future deployments

  See: docs/DATABASE_WORKFLOW.md for detailed troubleshooting
  See: .claude/skills/supabase-workflow/SKILL.md for automated guidance
  See: .claude/skills/supabase-branch-parity/SKILL.md for parity fixes

  ---
  Authentication Architecture                                                              
                                                                                           
  Flow: Clerk → Supabase RLS                                                               
                                                                                           
  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐                          
  │   Clerk     │         │    App      │         │  Supabase   │                          
  │  (Auth)     │         │  (React)    │         │  (Database) │                          
  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘                          
         │                       │                       │                                 
         │  1. User signs in     │                       │                                 
         │<─────────────────────│                       │                                  
         │                       │                       │                                 
         │  2. Returns JWT       │                       │                                 
         │─────────────────────>│                       │                                  
         │                       │                       │                                 
         │                       │  3. getToken()        │                                 
         │                       │  (from Clerk)         │                                 
         │                       │                       │                                 
         │                       │  4. API call with     │                                 
         │                       │  Authorization:       │                                 
         │                       │  Bearer <clerk_jwt>   │                                 
         │                       │─────────────────────>│                                  
         │                       │                       │                                 
         │                       │  5. Supabase verifies │                                 
         │                       │  JWT via Clerk JWKS   │                                 
         │                       │                       │                                 
         │                       │  6. RLS policies use  │                                 
         │                       │  auth.jwt()->'sub'    │                                 
         │                       │<─────────────────────│                                  
                                                                                           
  Code Pattern                                                                             
                                                                                           
  // In any component:                                                                     
  import { useSupabase } from '../lib/supabase';                                           
  import { useAuth } from '../lib/auth-context';                                           
                                                                                           
  function MyComponent() {                                                                 
    const { userId } = useAuth();                                                          
    const { getSupabase } = useSupabase();                                                 
                                                                                           
    const fetchData = async () => {                                                        
      const supabase = await getSupabase(); // Gets authenticated client                   
      const { data, error } = await supabase                                               
        .from('expenses')                                                                  
        .select('*')                                                                       
        .eq('group_id', groupId);                                                          
      // RLS automatically filters to user's accessible data                               
    };                                                                                     
  }                                                                                        
                                                                                           
  ---                                                                                      
  Database Schema (Key Tables)                                                             
                                                                                           
  -- Core tables                                                                           
  groups (id, name, emoji, currency, share_code, created_at, archived_at)                  
  members (id, group_id, name, clerk_user_id, created_at)                                  
  expenses (id, group_id, description, amount, paid_by, category, created_at)              
  splits (id, expense_id, member_id, amount)                                               
  settlements (id, group_id, from_member_id, to_member_id, amount, method)                 
                                                                                           
  -- User & Social                                                                         
  user_profiles (id, clerk_id, display_name, email, venmo_username)                        
  friendships (id, requester_id, addressee_id, status)                                     
  push_tokens (id, user_id, token, platform)                                               
                                                                                           
  -- Receipt scanning                                                                      
  receipts (id, group_id, image_url, ocr_status, merchant_name, total_amount)              
  receipt_items (id, receipt_id, description, quantity, total_price)                       
  item_claims (id, receipt_item_id, member_id, claim_type, share_fraction)                 
                                                                                           
  RLS Pattern                                                                              
                                                                                           
  All tables use Row Level Security. Policies verify:                                      
  - User is authenticated (auth.jwt() IS NOT NULL)                                         
  - User's Clerk ID matches membership (clerk_user_id = auth.jwt()->>'sub')                
                                                                                           
  ---                                                                                      
  Navigation (Expo Router)                                                                 
                                                                                           
  File → Route Mapping                                                                     
  File: app/index.tsx                                                                      
  Route: /                                                                                 
  Notes: Redirects to /(tabs)                                                              
  ────────────────────────────────────────                                                 
  File: app/(tabs)/index.tsx                                                               
  Route: / (tabs)                                                                          
  Notes: Groups list                                                                       
  ────────────────────────────────────────                                                 
  File: app/(tabs)/scan.tsx                                                                
  Route: /scan                                                                             
  Notes: Receipt/QR scanner                                                                
  ────────────────────────────────────────                                                 
  File: app/group/[id]/index.tsx                                                           
  Route: /group/123                                                                        
  Notes: Dynamic route                                                                     
  ────────────────────────────────────────                                                 
  File: app/group/[id]/expense/[expenseId].tsx                                             
  Route: /group/123/expense/456                                                            
  Notes: Nested dynamic                                                                    
  ────────────────────────────────────────                                                 
  File: app/auth/sign-in.tsx                                                               
  Route: /auth/sign-in                                                                     
  Notes: Auth group                                                                        
  Navigation Patterns                                                                      
                                                                                           
  import { router } from 'expo-router';                                                    
                                                                                           
  // Push (adds to stack)                                                                  
  router.push('/group/123');                                                               
                                                                                           
  // Replace (replaces current)                                                            
  router.replace('/auth/sign-in');                                                         
                                                                                           
  // Back                                                                                  
  router.back();                                                                           
                                                                                           
  // With params                                                                           
  router.push(`/join?code=${shareCode}`);                                                  
                                                                                           
  // Access params                                                                         
  const { id } = useLocalSearchParams<{ id: string }>();                                   
                                                                                           
  Deep Links                                                                               
  ┌──────────────┬───────────────────────────┬───────────────────────────────┐             
  │    Scheme    │          Pattern          │            Handler            │             
  ├──────────────┼───────────────────────────┼───────────────────────────────┤             
  │ splitfree:// │ splitfree://join/{code}   │ Opens /join?code={code}       │             
  ├──────────────┼───────────────────────────┼───────────────────────────────┤             
  │ https://     │ splitfree.app/join/{code} │ Universal link → same handler │             
  └──────────────┴───────────────────────────┴───────────────────────────────┘             
  ---                                                                                      
  State Management                                                                         
                                                                                           
  No Redux/Zustand - React Patterns Only                                                   
                                                                                           
  // 1. Local state (useState)                                                             
  const [loading, setLoading] = useState(false);                                           
                                                                                           
  // 2. Screen data with useFocusEffect                                                    
  useFocusEffect(                                                                          
    useCallback(() => {                                                                    
      fetchData();                                                                         
    }, [fetchData])                                                                        
  );                                                                                       
                                                                                           
  // 3. Global auth state (Context)                                                        
  const { userId, user, signOut } = useAuth();                                             
                                                                                           
  // 4. Supabase as source of truth                                                        
  // Always fetch fresh data, sync every 10 seconds                                        
                                                                                           
  Data Fetching Pattern                                                                    
                                                                                           
  const [data, setData] = useState<Group[]>([]);                                           
  const [loading, setLoading] = useState(true);                                            
  const [refreshing, setRefreshing] = useState(false);                                     
                                                                                           
  const fetchData = useCallback(async () => {                                              
    const supabase = await getSupabase();                                                  
    const { data, error } = await supabase                                                 
      .from('groups')                                                                      
      .select('*')                                                                         
      .order('created_at', { ascending: false });                                          
                                                                                           
    if (error) throw error;                                                                
    setData(data || []);                                                                   
  }, [getSupabase]);                                                                       
                                                                                           
  // Initial load                                                                          
  useEffect(() => {                                                                        
    fetchData().finally(() => setLoading(false));                                          
  }, []);                                                                                  
                                                                                           
  // Refetch on screen focus                                                               
  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));                        
                                                                                           
  // Pull to refresh                                                                       
  const onRefresh = () => {                                                                
    setRefreshing(true);                                                                   
    fetchData().finally(() => setRefreshing(false));                                       
  };                                                                                       
                                                                                           
  ---                                                                                      
  Key Development Commands                                                                 
                                                                                           
  # Start development server                                                               
  npm start                    # Expo Go (limited features)                                
  npx expo run:ios            # Native build (full features)                               
                                                                                           
  # Type checking                                                                          
  npm run typecheck           # npx tsc --noEmit                                           
                                                                                           
  # Testing                                                                                
  npm test                    # All tests                                                  
  npm run test:unit           # Unit tests only                                            
  npm run test:integration    # Supabase tests                                             
  npm run test:coverage       # With coverage report                                       
                                                                                           
  # Building                                                                               
  npm run build:testflight    # iOS TestFlight build                                       
  npm run build:sim-release   # Local simulator release build                              
                                                                                           
  # Database                                                                               
  # Migrations are applied via Supabase MCP or dashboard                                   
                                                                                           
  ---                                                                                      
  Error Handling Pattern                                                                   
                                                                                           
  Result Type (lib/result.ts)                                                              
                                                                                           
  import { Result, ok, fail, isSuccess, PostgresErrorCodes } from '../lib/result';         
                                                                                           
  async function createMember(name: string): Promise<Result<Member>> {                     
    const { data, error } = await supabase                                                 
      .from('members')                                                                     
      .insert({ name })                                                                    
      .select()                                                                            
      .single();                                                                           
                                                                                           
    if (error) {                                                                           
      if (error.code === PostgresErrorCodes.UNIQUE_VIOLATION) {                            
        return fail('Name already taken', error.code);                                     
      }                                                                                    
      return fail(error.message, error.code);                                              
    }                                                                                      
                                                                                           
    return ok(data);                                                                       
  }                                                                                        
                                                                                           
  // Usage                                                                                 
  const result = await createMember('Alice');                                              
  if (isSuccess(result)) {                                                                 
    console.log(result.data);                                                              
  } else {                                                                                 
    Alert.alert('Error', result.error);                                                    
  }                                                                                        
                                                                                           
  ---                                                                                      
  Common Patterns                                                                          
                                                                                           
  Supabase Queries                                                                         
                                                                                           
  // Select with joins                                                                     
  const { data } = await supabase                                                          
    .from('expenses')                                                                      
    .select(`                                                                              
      *,                                                                                   
      payer:members!paid_by(id, name),                                                     
      splits(member_id, amount)                                                            
    `)                                                                                     
    .eq('group_id', groupId)                                                               
    .is('deleted_at', null);                                                               
                                                                                           
  // Insert and return                                                                     
  const { data, error } = await supabase                                                   
    .from('groups')                                                                        
    .insert({ name, emoji, share_code })                                                   
    .select()                                                                              
    .single();                                                                             
                                                                                           
  // Batch insert                                                                          
  await supabase.from('splits').insert(splitRecords);                                      
                                                                                           
  // Update                                                                                
  await supabase                                                                           
    .from('expenses')                                                                      
    .update({ description: 'New name' })                                                   
    .eq('id', expenseId);                                                                  
                                                                                           
  Push Notifications                                                                       
                                                                                           
  import { notifyMemberJoined, notifySettlementRecorded } from '../lib/notifications';     
                                                                                           
  // After member joins                                                                    
  await notifyMemberJoined(supabase, groupId, memberName, groupName, excludeUserId);       
                                                                                           
  // After settlement                                                                      
  await notifySettlementRecorded(supabase, groupId, fromName, toName, amount,              
  excludeUserId);                                                                          
                                                                                           
  ---                                                                                      
  Testing Strategy                                                                         
                                                                                           
  Unit Tests (__tests__/utils.test.ts)                                                     
                                                                                           
  - Pure functions: calculateBalances, simplifyDebts, formatCurrency                       
  - No mocking required                                                                    
                                                                                           
  Integration Tests (__tests__/*.integration.test.ts)                                      
                                                                                           
  - Require SUPABASE_SERVICE_ROLE_KEY for write access                                     
  - Test actual database operations                                                        
  - Clean up test data in afterAll                                                         
                                                                                           
  Running Tests                                                                            
                                                                                           
  npm test                              # All                                              
  npm test -- --testPathPattern=utils   # Specific file                                    
  npm run test:coverage                 # With coverage                                    
                                                                                           
  ---                                                                                      
  Important Gotchas                                                                        
                                                                                           
  1. useFocusEffect vs useEffect: Use useFocusEffect for screen data that needs refreshing 
  when navigating back.                                                                    
  2. Authenticated Supabase: Always use const supabase = await getSupabase() for           
  RLS-protected operations.                                                                
  3. clerk_user_id vs user_id: The clerk_user_id column is the TEXT Clerk ID. Legacy       
  user_id is unused.                                                                       
  4. Expo Go Limitations: Push notifications, native modules require development build (npx
   expo run:ios).                                                                          
  5. Deep Link Format: Always use splitfree://join/{code} format. Handle URL encoding.     
  6. Currency: Group has default currency. Individual expenses can have different currency 
  with exchange rate.                                                                      
                                                                                           
  ---                                                                                      
  Deployment Checklist                                                                     
                                                                                           
  Before TestFlight/Production:                                                            
                                                                                           
  - All TypeScript errors resolved (npm run typecheck)                                     
  - Tests passing (npm test)                                                               
  - Environment variables set in EAS dashboard                                             
  - Sentry release configured                                                              
  - Privacy manifests up to date (app.json)                                                
  - App Store Connect build number incremented                                             
                                                                                           
  EAS Environment Variables (expo.dev)                                                     
                                                                                           
  - EXPO_PUBLIC_SUPABASE_URL                                                               
  - EXPO_PUBLIC_SUPABASE_ANON_KEY                                                          
  - EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY                                                      
  - EXPO_PUBLIC_SENTRY_DSN                                                                 
  - EXPO_PUBLIC_POSTHOG_API_KEY                                                            
  - SENTRY_AUTH_TOKEN (for source maps)
