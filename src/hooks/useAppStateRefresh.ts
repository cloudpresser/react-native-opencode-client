import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Calls `onResume` when the app transitions from background/inactive to active.
 * Used by ChatTab to refetch messages when the user returns to the app.
 * This hook handles data freshness only -- it has no notification logic.
 */
export function useAppStateRefresh(onResume: () => void) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground =
        appState.current === 'background' || appState.current === 'inactive';

      if (wasBackground && nextState === 'active') {
        onResumeRef.current();
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);
}
