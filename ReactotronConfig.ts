/**
 * Reactotron Configuration
 *
 * Development debugging tool for React Native.
 * Provides real-time state inspection, API call monitoring,
 * and async storage debugging.
 *
 * Only imported on native platforms (iOS/Android) in development mode.
 * The import is guarded in _layout.tsx with Platform.OS !== "web".
 */

import Reactotron from "reactotron-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Type declaration for console.tron
declare global {
  interface Console {
    tron?: typeof Reactotron;
  }
}

Reactotron.setAsyncStorageHandler?.(AsyncStorage)
  .configure({
    name: "SplitFree",
  })
  .useReactNative({
    asyncStorage: true,
    networking: {
      ignoreUrls: /symbolicate|127\.0\.0\.1|localhost/,
    },
    errors: { veto: () => false },
    editor: false,
  })
  .connect();

// Extend console to include Reactotron logging
const originalConsoleLog = console.log;
console.log = (...args: unknown[]) => {
  originalConsoleLog(...args);
  Reactotron.log?.(...args);
};

console.tron = Reactotron;

export default Reactotron;
