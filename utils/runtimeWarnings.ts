import { LogBox } from 'react-native';

const IGNORED_PATTERNS = [
  '[SafeWalk]',
  '[sendEmailAlert]',
  'Possible Unhandled Promise Rejection',
  'Warning:',
];

let hasInitialized = false;

export function suppressRuntimeWarnings() {
  if (hasInitialized) {
    return;
  }

  hasInitialized = true;
  LogBox.ignoreLogs(IGNORED_PATTERNS);

  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args: unknown[]) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : '';
    if (IGNORED_PATTERNS.some((pattern) => firstArg.includes(pattern))) {
      return;
    }
    originalWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : '';
    if (IGNORED_PATTERNS.some((pattern) => firstArg.includes(pattern))) {
      return;
    }
    originalError(...args);
  };
}
