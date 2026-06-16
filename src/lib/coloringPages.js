import { coloringPages as IMAGE_PAGES } from '../data/coloringPages'

export const CATEGORIES = {
  animals: 'Animals',
  nature: 'Nature',
  space: 'Space',
  fantasy: 'Fantasy',
  mandala: 'Mandala',
  scenes: 'Scenes',
  jungle: 'Jungle',
  dinosaurs: 'Dinosaurs',
}

export const DURATIONS = {
  easy:   { label: 'Quick Picks',  minutes: 7  },
  medium: { label: 'Cozy Scenes',  minutes: 20 },
  hard:   { label: 'Tiny Adventures', minutes: 45 },
}

// Existing hand-built SVG pages. Image-based pages from src/data/coloringPages.js
// are normalised and merged into COLORING_PAGES below.

const SVG_PAGES = []

// Normalise image-based pages (new schema) into the internal page shape used
// across the app: { id, name, category, duration, svgContent, imageUrl, ... }.
const NORMALIZED_IMAGE_PAGES = IMAGE_PAGES.map(p => ({
  id: p.id,
  name: p.title,
  category: p.category || p.tags?.[0] || 'scenes',
  duration: p.difficulty || 'easy',     // picker tabs use easy/medium/hard
  svgContent: null,                     // image-based — rendered via imageUrl
  imageUrl: p.imageUrl,
  thumbnailUrl: p.thumbnailUrl || p.imageUrl,
  estimatedMinutes: p.estimatedMinutes,
  tags: p.tags || [],
}))

// Image pages first so the new built-in library is the first thing users see.
export const COLORING_PAGES = [...NORMALIZED_IMAGE_PAGES, ...SVG_PAGES]

export function getPagesByDuration(duration) {
  return COLORING_PAGES.filter(p => p.duration === duration)
}
export function getPagesByCategory(category) {
  return COLORING_PAGES.filter(p => p.category === category)
}
export function getPageById(id) {
  return COLORING_PAGES.find(p => p.id === id)
}
