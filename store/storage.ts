import { createMMKV } from 'react-native-mmkv';
import { createJSONStorage, StateStorage } from 'zustand/middleware';

const mmkv = createMMKV({ id: 'drive-side-store' });

const mmkvStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => mmkv.remove(name),
};

export const persistedStorage = createJSONStorage(() => mmkvStorage);
