import cookies from "js-cookie";
import { Store } from "../../flux";
import { loadStaticVocabData } from "./staticVocabClient";

// Utility functions
const formatString = (str) => Store.formatString(str);
const getCurrentLocale = () => cookies.get("i18next") || "en";

// API functions
export const getAlphabetsList = () => Store.getAlphabetsList();

// Fetch ALL vocabulary from the static dataset (used for full-data scenarios)
export const fetchVocabData = async () => {
  const rawData = await loadStaticVocabData();

  const data = rawData.map((item) => cleanItem(transformItem(item)));

  return data.slice().sort((a, b) =>
    a.kumpulanKategori.localeCompare(b.kumpulanKategori)
  );
};

// Alphabet-specific caching
export const alphabetCache = new Map();
export const alphabetCacheTimestamps = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

// In-flight request deduplication — prevents parallel components from
// firing the same API call simultaneously
const inFlightRequests = new Map();

export const getVocabsByAlphabet = async (alphabetFirst) => {
  if (!alphabetFirst) return [];

  try {
    const now = Date.now();

    if (
      alphabetCache.has(alphabetFirst) &&
      alphabetCacheTimestamps.has(alphabetFirst) &&
      now - alphabetCacheTimestamps.get(alphabetFirst) < CACHE_DURATION
    ) {
      console.log(`Using cached data for alphabet: ${alphabetFirst}`);
      return alphabetCache.get(alphabetFirst);
    }

    console.log(`Cache miss for alphabet: ${alphabetFirst}, fetching from API`);
    const vocabAlpha = await fetchVocabsByAlphabetFromAPI(alphabetFirst);

    alphabetCache.set(alphabetFirst, vocabAlpha);
    alphabetCacheTimestamps.set(alphabetFirst, now);

    return vocabAlpha;
  } catch (error) {
    console.error("Error in getVocabsByAlphabet:", error);

    if (alphabetCache.has(alphabetFirst)) {
      console.log(`Using expired cache for alphabet: ${alphabetFirst} due to error`);
      return alphabetCache.get(alphabetFirst);
    }

    const storeVocabs = Store.getVocabsItems();
    if (storeVocabs?.length > 0) {
      console.log("Falling back to Store data");
      return getVocabsFromStore(alphabetFirst, storeVocabs);
    }

    return [];
  }
};

export const clearAlphabetCache = (alphabetFirst = null) => {
  if (alphabetFirst) {
    alphabetCache.delete(alphabetFirst);
    alphabetCacheTimestamps.delete(alphabetFirst);
    console.log(`Cache cleared for alphabet: ${alphabetFirst}`);
  } else {
    alphabetCache.clear();
    alphabetCacheTimestamps.clear();
    console.log("All caches cleared");
  }
};

// Single-request fetch per alphabet letter using the static dataset
export const fetchVocabsByAlphabetFromAPI = async (alphabetFirst) => {
  if (!alphabetFirst) return [];

  // Deduplicate in-flight requests for the same letter
  if (inFlightRequests.has(alphabetFirst)) {
    console.log(`Reusing in-flight request for alphabet: ${alphabetFirst}`);
    return inFlightRequests.get(alphabetFirst);
  }

  const uppercaseAlphabet = alphabetFirst.toUpperCase();
  const locale = getCurrentLocale();

  console.log(
    `Fetching data from static dataset for alphabet: ${uppercaseAlphabet}`
  );

  const requestPromise = loadStaticVocabData()
    .then((allItems) =>
      allItems
        .filter((item) => {
          const value =
            locale === "ms" ? item.perkataan || "" : item.word || "";
          return value.toUpperCase().startsWith(uppercaseAlphabet);
        })
        .sort((a, b) =>
          locale === "ms"
            ? a.perkataan.localeCompare(b.perkataan)
            : a.word.localeCompare(b.word)
        )
    )
    .finally(() => {
      inFlightRequests.delete(alphabetFirst);
    });

  inFlightRequests.set(alphabetFirst, requestPromise);
  return requestPromise;
};

// Get new signs with caching — reads from static dataset
export const getNewSigns = async () => {
  const cacheKey = "new-signs";

  try {
    const now = Date.now();

    if (
      alphabetCache.has(cacheKey) &&
      alphabetCacheTimestamps.has(cacheKey) &&
      now - alphabetCacheTimestamps.get(cacheKey) < CACHE_DURATION
    ) {
      console.log(`Using cached data for new signs`);
      return alphabetCache.get(cacheKey);
    }

    console.log(`Cache miss for new signs, reading from static dataset`);

    const locale = getCurrentLocale();
    const allItems = await loadStaticVocabData();

    const processedData = allItems
      .filter((item) => (item.new || "").toLowerCase() === "yes")
      .sort((a, b) =>
        locale === "ms"
          ? a.perkataan.localeCompare(b.perkataan)
          : a.word.localeCompare(b.word)
      )
      .slice(0, 25);

    alphabetCache.set(cacheKey, processedData);
    alphabetCacheTimestamps.set(cacheKey, now);

    console.log(`API returned ${processedData.length} new sign items`);
    return processedData;
  } catch (error) {
    console.error("Error in getNewSigns:", error);

    if (alphabetCache.has(cacheKey)) {
      console.log(`Using expired cache for new signs due to error`);
      return alphabetCache.get(cacheKey);
    }

    return [];
  }
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

const transformItem = (item) => {
  const categoryGroup = item.category_group || {};
  return {
    kumpulanKategori:
      item.kumpulanKategori ||
      categoryGroup.KumpulanKategori ||
      `${item.Kumpulan || ""}/${item.Kategori || ""}`,
    groupCategory:
      item.groupCategory ||
      categoryGroup.GroupCategory ||
      `${item.Group || ""}/${item.Category || ""}`,
    word: item.word || item.Word || "",
    perkataan: item.perkataan || item.Perkataan || "",
    video: item.video || item.Video || "",
    tag: item.tag || item.Tag || "",
    new: item.new || item.New || "No",
    order: item.order || item.Order || "",
    imgStatus: item.imgStatus || item.Image_Status || "",
  };
};

const cleanItem = (item) => ({
  kumpulanKategori: item.kumpulanKategori.toString().replaceAll(/(\r\n|\n|\r)/gm, ""),
  groupCategory: item.groupCategory.toString().replaceAll(/(\r\n|\n|\r)/gm, ""),
  word: item.word.toString().trim(),
  perkataan: item.perkataan.toString().trim(),
  video: item.video,
  tag: item.tag,
  new: item.new,
  order: item.order,
  imgStatus: item.imgStatus,
});

const getVocabsFromStore = (alphabetFirst, vocabsItems) => {
  const locale = getCurrentLocale();

  return vocabsItems
    .filter((vocAl) =>
      locale === "ms"
        ? (vocAl.perkataan || vocAl.Perkataan)
            ?.toLowerCase()
            .startsWith(alphabetFirst.toLowerCase())
        : (vocAl.word || vocAl.Word)
            ?.toLowerCase()
            .startsWith(alphabetFirst.toLowerCase())
    )
    .sort((a, b) =>
      locale === "ms"
        ? (a.perkataan || a.Perkataan).localeCompare(b.perkataan || b.Perkataan)
        : (a.word || a.Word).localeCompare(b.word || b.Word)
    );
};