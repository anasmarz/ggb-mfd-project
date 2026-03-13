import levenshtein from 'js-levenshtein';
import { Store } from "../../flux";
import { alphabetCache, alphabetCacheTimestamps } from "./alphabetAPI";
import { loadStaticVocabData } from "./staticVocabClient";

// Utility: Format string using Store method
const formatString = (str) => Store.formatString(str);

// Utility: Capitalize the first letter
const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Cache setup
const vocabCache = new Map();
const vocabCacheTimestamps = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Find vocab in alphabet cache (avoids a network call entirely)
const findVocabInAlphabetData = (vocabName) => {
  if (!vocabName) return null;

  const formatted = formatString(vocabName);
  const firstLetter = formatted.charAt(0);

  if (alphabetCache?.has(firstLetter)) {
    console.log(`Looking for "${vocabName}" in alphabet cache [${firstLetter}]`);

    const entries = alphabetCache.get(firstLetter);
    const matches = entries.filter(
      (item) => !formatString(item.word).localeCompare(formatted)
    );

    if (matches.length > 0) {
      console.log(`Found "${vocabName}" in alphabet cache`);
      return matches;
    }
  }

  return null;
};

// Transform an item from the static dataset into the expected vocab shape
const transformVocabItem = (item) => ({
  kumpulanKategori: item.kumpulanKategori || `${item.Kumpulan}/${item.Kategori}`,
  groupCategory: item.groupCategory || `${item.Group}/${item.Category}`,
  word: item.word || item.Word || '',
  perkataan: item.perkataan || item.Perkataan || '',
  video: item.video || item.Video || '',
  tag: item.tag || item.Tag || '',
  new: item.new || item.New || 'No',
  order: item.order || item.Order || '',
  imgStatus: item.imgStatus || item.Image_Status || ''
});

// Fetch vocab from the static dataset — no database calls
export const fetchVocabDetailFromAPI = async (vocabName) => {
  if (!vocabName) return null;

  const formatted = formatString(vocabName);
  const capitalized = capitalizeFirstLetter(vocabName);

  try {
    // Check alphabet cache first — free lookup, no network cost
    const cachedData = findVocabInAlphabetData(vocabName);
    if (cachedData) return cachedData;

    console.log(`Fetching "${vocabName}" from static dataset`);
    const allItems = await loadStaticVocabData();

    const filtered = allItems
      .map(transformVocabItem)
      .filter((entry) => !formatString(entry.word).localeCompare(formatted));

    return filtered.length > 0 ? filtered : null;
  } catch (error) {
    console.error("API error while fetching vocab:", error);
    return null;
  }
};

// Get vocab with caching
export const getVocabDetail = async (vocabName) => {
  if (!vocabName) return null;

  const now = Date.now();

  try {
    // Return cached if still valid
    if (
      vocabCache.has(vocabName) &&
      vocabCacheTimestamps.has(vocabName) &&
      now - vocabCacheTimestamps.get(vocabName) < CACHE_DURATION
    ) {
      console.log(`Using cached vocab: "${vocabName}"`);
      return vocabCache.get(vocabName);
    }

    // Check alphabet cache (no network cost)
    const alphabetData = findVocabInAlphabetData(vocabName);
    if (alphabetData) {
      vocabCache.set(vocabName, alphabetData);
      vocabCacheTimestamps.set(vocabName, now);
      return alphabetData;
    }

    // Fetch from API as last resort
    console.log(`Cache miss for "${vocabName}", querying API...`);
    const fetched = await fetchVocabDetailFromAPI(vocabName);

    if (fetched) {
      vocabCache.set(vocabName, fetched);
      vocabCacheTimestamps.set(vocabName, now);
    }

    return fetched;
  } catch (err) {
    console.error(`Failed to get vocab: "${vocabName}"`, err);

    // Fallback to stale cache
    if (vocabCache.has(vocabName)) {
      console.log(`Using stale cache for "${vocabName}"`);
      return vocabCache.get(vocabName);
    }

    // Last-resort fallback to Store
    console.log(`Falling back to Store for "${vocabName}"`);
    return Store.getVocabDetail(vocabName);
  }
};

// Clear vocab cache
export const clearVocabCache = (vocabName = null) => {
  if (vocabName) {
    vocabCache.delete(vocabName);
    vocabCacheTimestamps.delete(vocabName);
    console.log(`Cleared cache for: "${vocabName}"`);
  } else {
    vocabCache.clear();
    vocabCacheTimestamps.clear();
    console.log("Cleared all vocab caches");
  }
};

// Find similar words using Levenshtein distance
export const findSimilarWords = async (vocabName, limit = 5) => {
  if (!vocabName) return [];

  try {
    const formatted = formatString(vocabName);
    const firstLetter = formatted.charAt(0);

    let wordsFromSameAlphabet = [];

    if (alphabetCache.has(firstLetter)) {
      // Already in memory — no network call needed
      wordsFromSameAlphabet = alphabetCache.get(firstLetter);
    } else {
      const { getVocabsByAlphabet } = await import('./alphabetAPI');
      wordsFromSameAlphabet = await getVocabsByAlphabet(firstLetter);
    }

    const scoredWords = wordsFromSameAlphabet
      .filter((item) => formatString(item.word) !== formatted)
      .map((item) => ({
        ...item,
        score: levenshtein(formatString(item.word), formatted)
      }));

    return scoredWords
      .sort((a, b) => a.score - b.score)
      .slice(0, limit);
  } catch (err) {
    console.error(`Failed to find similar words for: "${vocabName}"`, err);
    return [];
  }
};