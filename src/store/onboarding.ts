import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  selectedGenres: string[];

  // Actions
  completeOnboarding: (genres: string[]) => void;
  resetOnboarding: () => void;
  updateSelectedGenres: (genres: string[]) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      selectedGenres: [],

      completeOnboarding: (genres: string[]) => {
        set({
          hasCompletedOnboarding: true,
          selectedGenres: genres
        });
      },

      resetOnboarding: () => {
        set({
          hasCompletedOnboarding: false,
          selectedGenres: []
        });
      },

      updateSelectedGenres: (genres: string[]) => {
        set({ selectedGenres: genres });
      }
    }),
    {
      name: 'audiovibe-onboarding-storage'
    }
  )
);
