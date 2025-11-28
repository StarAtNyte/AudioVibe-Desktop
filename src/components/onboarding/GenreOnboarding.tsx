import React, { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';

interface GenreOnboardingProps {
  onComplete: (selectedGenres: string[]) => void;
}

interface GenreCategory {
  name: string;
  color: string;
  genres: string[];
}

const genreCategories: GenreCategory[] = [
  {
    name: "Children's",
    color: "pink",
    genres: [
      'Children',
      'Animals & Nature',
      'Action & Adventure',
      'Myths & Legends',
      'Fairy Tales',
      'Bedtime Stories'
    ]
  },
  {
    name: "Crime & Thriller",
    color: "red",
    genres: [
      'Crime',
      'Mystery',
      'Detective',
      'Suspense',
      'Thriller',
      'True Crime'
    ]
  },
  {
    name: "Culture & Heritage",
    color: "orange",
    genres: [
      'Culture',
      'Heritage',
      'History',
      'Biography',
      'Religion',
      'Philosophy',
      'Spirituality'
    ]
  },
  {
    name: "Fantasy & Sci-Fi",
    color: "purple",
    genres: [
      'Fantasy',
      'Science Fiction',
      'Dystopian',
      'Time Travel',
      'Superhero'
    ]
  },
  {
    name: "Health & Wellness",
    color: "green",
    genres: [
      'Diet',
      'Nutrition',
      'Exercise',
      'Fitness',
      'Mental Health',
      'Self-Help',
      'Personal Development'
    ]
  },
  {
    name: "History & Politics",
    color: "blue",
    genres: [
      'History',
      'Politics',
      'World History',
      'Political Science',
      'Military History',
      'Historical Fiction'
    ]
  },
  {
    name: "Horror",
    color: "gray",
    genres: [
      'Horror',
      'Gothic',
      'Supernatural',
      'Psychological'
    ]
  },
  {
    name: "Humor",
    color: "yellow",
    genres: [
      'Humor',
      'Satire',
      'Parody',
      'Comedy'
    ]
  },
  {
    name: "Love & Romance",
    color: "rose",
    genres: [
      'Love',
      'Romance',
      'Romantic Comedy',
      'Romantic Suspense'
    ]
  },
  {
    name: "Non-Fiction",
    color: "amber",
    genres: [
      'Biography',
      'Memoir',
      'Self-Help',
      'Science',
      'Business',
      'Travel',
      'Art'
    ]
  },
  {
    name: "Science & Technology",
    color: "indigo",
    genres: [
      'Science',
      'Technology',
      'Engineering',
      'Mathematics',
      'Astronomy',
      'Physics',
      'Computer'
    ]
  },
  {
    name: "Sports & Outdoors",
    color: "emerald",
    genres: [
      'Sports',
      'Outdoors',
      'Football',
      'Basketball',
      'Baseball',
      'Soccer'
    ]
  }
];

const colorClasses = {
  pink: 'border-pink-500 bg-pink-500 text-white hover:bg-pink-600',
  red: 'border-red-500 bg-red-500 text-white hover:bg-red-600',
  orange: 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600',
  purple: 'border-purple-500 bg-purple-500 text-white hover:bg-purple-600',
  green: 'border-green-500 bg-green-500 text-white hover:bg-green-600',
  blue: 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600',
  gray: 'border-gray-700 bg-gray-700 text-white hover:bg-gray-800',
  yellow: 'border-yellow-500 bg-yellow-500 text-gray-900 hover:bg-yellow-600',
  rose: 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600',
  amber: 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600',
  indigo: 'border-indigo-500 bg-indigo-500 text-white hover:bg-indigo-600',
  emerald: 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'
};

const colorBorderClasses = {
  pink: 'border-pink-500/30 hover:border-pink-500',
  red: 'border-red-500/30 hover:border-red-500',
  orange: 'border-orange-500/30 hover:border-orange-500',
  purple: 'border-purple-500/30 hover:border-purple-500',
  green: 'border-green-500/30 hover:border-green-500',
  blue: 'border-blue-500/30 hover:border-blue-500',
  gray: 'border-gray-700/30 hover:border-gray-700',
  yellow: 'border-yellow-500/30 hover:border-yellow-500',
  rose: 'border-rose-500/30 hover:border-rose-500',
  amber: 'border-amber-500/30 hover:border-amber-500',
  indigo: 'border-indigo-500/30 hover:border-indigo-500',
  emerald: 'border-emerald-500/30 hover:border-emerald-500'
};

export const GenreOnboarding: React.FC<GenreOnboardingProps> = ({ onComplete }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => {
      const newSet = new Set(prev);
      if (newSet.has(genre)) {
        newSet.delete(genre);
      } else {
        newSet.add(genre);
      }
      return newSet;
    });
  };

  const handleContinue = () => {
    onComplete(Array.from(selectedGenres));
  };

  const minGenres = 3;
  const remainingGenres = Math.max(0, minGenres - selectedGenres.size);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center z-50 overflow-hidden">
      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to AudioVibe!
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Choose at least <span className="font-semibold text-indigo-600 dark:text-indigo-400">{minGenres} genres</span> to personalize your experience:
            </p>
          </div>
        </div>

        {/* Genre Selection */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-3">
              {genreCategories.map((category) => {
                const isExpanded = expandedCategories.has(category.name);
                const color = category.color as keyof typeof colorClasses;

                return (
                  <React.Fragment key={category.name}>
                    {/* Main Category Chip */}
                    <button
                      onClick={() => toggleCategory(category.name)}
                      className={`px-4 py-2 rounded-full border-2 font-medium transition-all
                        ${isExpanded
                          ? colorClasses[color]
                          : `bg-white dark:bg-gray-800 ${colorBorderClasses[color]} text-gray-700 dark:text-gray-300`
                        }`}
                    >
                      {category.name} +
                    </button>

                    {/* Sub-genres */}
                    {isExpanded && category.genres.map((genre) => {
                      const isSelected = selectedGenres.has(genre);
                      return (
                        <button
                          key={genre}
                          onClick={() => toggleGenre(genre)}
                          className={`px-4 py-2 rounded-full border-2 font-medium transition-all flex items-center gap-2
                            ${isSelected
                              ? colorClasses[color]
                              : `bg-white dark:bg-gray-800 ${colorBorderClasses[color]} text-gray-700 dark:text-gray-300`
                            }`}
                        >
                          {isSelected && <Check size={16} />}
                          {genre}
                        </button>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Genres Summary & Continue Button */}
        {selectedGenres.size > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow-lg p-6 md:p-8 border-t border-gray-200 dark:border-gray-700">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <Check className="text-indigo-600 dark:text-indigo-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Selected Genres ({selectedGenres.size})
                    </h3>
                    {remainingGenres > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Select {remainingGenres} more genre{remainingGenres === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleContinue}
                  disabled={selectedGenres.size < minGenres}
                  className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all
                    ${selectedGenres.size >= minGenres
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                    }`}
                >
                  {selectedGenres.size >= minGenres ? 'Continue to Homepage' : `Select ${remainingGenres} more`}
                  {selectedGenres.size >= minGenres && <ChevronRight size={20} />}
                </button>
              </div>

              {/* Selected genres preview */}
              <div className="flex flex-wrap gap-2">
                {Array.from(selectedGenres).map((genre) => {
                  const category = genreCategories.find(c => c.genres.includes(genre));
                  const color = (category?.color || 'gray') as keyof typeof colorClasses;
                  return (
                    <div
                      key={genre}
                      className={`px-3 py-1 rounded-full text-sm ${colorClasses[color]}`}
                    >
                      {genre}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
