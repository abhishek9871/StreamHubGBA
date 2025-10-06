import { useState, useCallback, useEffect, Dispatch, SetStateAction } from 'react';
import { storageService } from '../services/storage';

/**
 * A custom hook that synchronizes a state with localStorage.
 * It behaves like `useState`, but persists the value to localStorage.
 * This version ensures localStorage is updated synchronously with the state update
 * to prevent race conditions.
 *
 * @param key The key to use in localStorage.
 * @param initialValue The initial value to use if nothing is in localStorage.
 * @returns A stateful value, and a function to update it.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // Get initial value from localStorage or use the initialValue provided.
  const [storedValue, setStoredValue] = useState<T>(() => {
    return storageService.getItem(key, initialValue);
  });

  // Create a stable setter function that updates both React state and localStorage.
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      // The updater function form of setState ensures we always have the latest state.
      setStoredValue((prevState) => {
        // Determine the new value, supporting both direct value and function forms.
        const valueToStore = value instanceof Function ? value(prevState) : value;
        // Persist to localStorage synchronously.
        storageService.setItem(key, valueToStore);
        // Return the new value to update React state.
        return valueToStore;
      });
    },
    [key] // The key is the only dependency, making this function stable.
  );

  // Effect to listen for changes from other tabs to sync state.
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        if (event.newValue) {
          try {
            setStoredValue(JSON.parse(event.newValue));
          } catch {
            setStoredValue(initialValue);
          }
        } else {
          // The item was removed from storage in another tab.
          setStoredValue(initialValue);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}
