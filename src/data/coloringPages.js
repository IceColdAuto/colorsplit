// Built-in coloring-page library (image/PNG based MVP).
//
// Drop a coloring-page PNG into public/coloring-pages/ and add an entry here.
// imageUrl/thumbnailUrl are absolute paths from the web root (public/ is served
// at /). Use the same file for both unless you add a separate small thumbnail.
//
// difficulty maps to the picker's three tabs: 'easy' | 'medium' | 'hard'.
// These pages are merged into the existing built-in list in lib/coloringPages.js,
// so they automatically show up in the picker and round-trip through
// solo / multiplayer / reveal via getPageById(id).

export const coloringPages = [
  {
    id: 'jungle-treehouse',
    title: 'Jungle Treehouse',
    imageUrl: '/coloring-pages/jungle-treehouse.png',
    thumbnailUrl: '/coloring-pages/jungle-treehouse.png',
    difficulty: 'easy',
    estimatedMinutes: 10,
    tags: ['jungle', 'animals', 'funny'],
  },
  {
    id: 'dino-dreamland',
    title: 'Dino Dreamland',
    imageUrl: '/coloring-pages/dino-dreamland.png',
    thumbnailUrl: '/coloring-pages/dino-dreamland.png',
    difficulty: 'medium',
    estimatedMinutes: 20,
    tags: ['dinosaurs', 'animals', 'nature'],
  },
  {
    id: 'space-friends',
    title: 'Space Friends',
    imageUrl: '/coloring-pages/space-friends.png',
    thumbnailUrl: '/coloring-pages/space-friends.png',
    difficulty: 'easy',
    estimatedMinutes: 12,
    tags: ['space', 'animals', 'funny'],
  },
  {
    id: 'ocean-whale-kingdom',
    title: 'Ocean Whale Kingdom',
    imageUrl: '/coloring-pages/ocean-whale-kingdom.png',
    thumbnailUrl: '/coloring-pages/ocean-whale-kingdom.png',
    difficulty: 'easy',
    estimatedMinutes: 10,
    tags: ['ocean', 'animals', 'kawaii'],
  },
  {
    id: 'autumn-harvest',
    title: 'Autumn Harvest',
    imageUrl: '/coloring-pages/autumn-harvest.png',
    thumbnailUrl: '/coloring-pages/autumn-harvest.png',
    difficulty: 'easy',
    estimatedMinutes: 12,
    tags: ['autumn', 'animals', 'kawaii'],
  },
  {
    id: 'pirate-sky-adventure',
    title: 'Pirate Sky Adventure',
    imageUrl: '/coloring-pages/pirate-sky-adventure.png',
    thumbnailUrl: '/coloring-pages/pirate-sky-adventure.png',
    difficulty: 'hard',
    estimatedMinutes: 30,
    tags: ['pirates', 'animals', 'adventure'],
  },
  {
    id: 'sheep-cloud-cafe',
    title: 'Sheep Cloud Café',
    imageUrl: '/coloring-pages/sheep-cloud-cafe.png',
    thumbnailUrl: '/coloring-pages/sheep-cloud-cafe.png',
    difficulty: 'easy',
    estimatedMinutes: 10,
    tags: ['animals', 'kawaii', 'food'],
  },
  {
    id: 'garden-baking-party',
    title: 'Garden Baking Party',
    imageUrl: '/coloring-pages/garden-baking-party.png',
    thumbnailUrl: '/coloring-pages/garden-baking-party.png',
    difficulty: 'medium',
    estimatedMinutes: 20,
    tags: ['animals', 'kawaii', 'food'],
  },
]
