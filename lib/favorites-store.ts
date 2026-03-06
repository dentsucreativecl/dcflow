"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface FavoriteItem {
  id: string;
  type: "list" | "folder" | "space" | "project";
  name: string;
  color?: string;
  parentName?: string;
}

interface FavoritesState {
  favorites: FavoriteItem[];
  addFavorite: (item: FavoriteItem) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (item: FavoriteItem) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (item) => {
        set((state) => ({
          favorites: [...state.favorites, item],
        }));
      },
      removeFavorite: (id) => {
        set((state) => ({
          favorites: state.favorites.filter((f) => f.id !== id),
        }));
      },
      isFavorite: (id) => {
        return get().favorites.some((f) => f.id === id);
      },
      toggleFavorite: (item) => {
        const state = get();
        if (state.favorites.some((f) => f.id === item.id)) {
          set({ favorites: state.favorites.filter((f) => f.id !== item.id) });
        } else {
          set({ favorites: [...state.favorites, item] });
        }
      },
    }),
    {
      name: "dc-flow-favorites",
      storage: createJSONStorage(() => localStorage),
    }
  )
);