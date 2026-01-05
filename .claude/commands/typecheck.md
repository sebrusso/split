# TypeScript Type Check

Run TypeScript compiler to check for type errors without emitting files.

## Command

```bash
npx tsc --noEmit
```

## Common Fixes

### Missing type imports
```typescript
import type { Group, Member, Expense } from '@/lib/types';
```

### Supabase nullable responses
```typescript
// Use non-null assertion when you've checked for errors
const { data, error } = await supabase.from('groups').select().single();
if (error) throw error;
const group = data!; // Safe after error check
```

### React Native component types
```typescript
import { ViewProps, TextProps, TouchableOpacityProps } from 'react-native';
```

## Strict Mode Notes
- `tsconfig.json` has strict mode enabled
- All function parameters require explicit types
- No implicit `any` allowed
- Null checks are required
