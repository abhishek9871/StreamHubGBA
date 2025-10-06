import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { storageService } from '../services/storage';

/**
 * A custom hook that synchronizes a state with localStorage.
 * It behaves like `useState`, but persists the value to localStorage.
 *
 * @param key The key to use in localStorage.
 * @param initialValue The initial value to use if nothing is in localStorage.
 * @returns A stateful value, and a function to update it.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // Read from localStorage on initial render
    return storageService.getItem(key, initialValue);
  });

  // Effect to update localStorage when the state changes
  useEffect(() => {
    storageService.setItem(key, storedValue);
  }, [key, storedValue]);

  // Effect to listen for changes from other tabs
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
          // The item was removed from storage in another tab
          setStoredValue(initialValue);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setStoredValue];
}