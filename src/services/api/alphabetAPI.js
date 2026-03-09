import axios from "axios";
import cookies from "js-cookie";
import { Store } from "../../flux";

// Utility functions
const formatString = (str) => Store.formatString(str);
const getCurrentLocale = () => cookies.get("i18next") || "en";

// Selective field population — avoids fetching unused relation data
const FIELD_PARAMS =
  "fields[0]=Word&fields[1]=Perkataan&fields[2]=Video&fields[3]=Tag&fields[4]=New&fields[5]=Order&fields[6]=Image_Status" +
  "&populate[category_group][fields][0]=KumpulanKategori&populate[category_group][fields][1]=GroupCategory";

const BASE_URL = "https://bimsignbank-strapi.onrender.com/api/bims";

// API functions
export const getAlphabetsList = () => Store.getAlphabetsList();

// Fetch ALL vocabulary in a single request (used for full-data scenarios)
export const fetchVocabData = async () => {
  try {
    const response = await axios.get(
      `${BASE_URL}?${FIELD_PARAMS}&pagination[pageSize]=2000`
    );

    if (!response.data?.data) {
      console.error("Invalid API response structure:", response);
      return [];
    }

    const processedData = response.data.data
      .map((item) => transformItem(item))
      .map(cleanItem)
      .sort((a, b) => a.kumpulanKategori.localeCompare(b.kumpulanKategori));

    return processedData;
  } catch (err) {
    console.error("Error fetching vocab data:", err);
    return [];
  }
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

// Single-request fetch per alphabet letter (replaces paginated while-loop)
export const fetchVocabsByAlphabetFromAPI = async (alphabetFirst) => {
  if (!alphabetFirst) return [];

  // Deduplicate in-flight requests for the same letter
  if (inFlightRequests.has(alphabetFirst)) {
    console.log(`Reusing in-flight request for alphabet: ${alphabetFirst}`);
    return inFlightRequests.get(alphabetFirst);
  }

  const locale = getCurrentLocale();
  const fieldToFilter = locale === "ms" ? "Perkataan" : "Word";
  const uppercaseAlphabet = alphabetFirst.toUpperCase();

  console.log(`Fetching data with filter: ${fieldToFilter} starts with ${uppercaseAlphabet}`);

  const requestPromise = axios
    .get(
      `${BASE_URL}?${FIELD_PARAMS}&pagination[pageSize]=500&filters[${fieldToFilter}][$startsWith]=${uppercaseAlphabet}`
    )
    .then((response) => {
      if (!response.data?.data) {
        console.error("Invalid API response structure:", response);
        return [];
      }

      const processedData = response.data.data
        .map((item) => transformItem(item))
        .map(cleanItem)
        .sort((a, b) =>
          locale === "ms"
            ? a.perkataan.localeCompare(b.perkataan)
            : a.word.localeCompare(b.word)
        );

      console.log(`API returned ${processedData.length} items for ${uppercaseAlphabet}`);
      return processedData;
    })
    .catch((err) => {
      console.error("Error fetching filtered data:", err);
      return [];
    })
    .finally(() => {
      inFlightRequests.delete(alphabetFirst);
    });

  inFlightRequests.set(alphabetFirst, requestPromise);
  return requestPromise;
};

// Get new signs with caching — single API request
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

    console.log(`Cache miss for new signs, fetching from API`);

    const locale = getCurrentLocale();

    const response = await axios.get(
      `${BASE_URL}?${FIELD_PARAMS}&sort=createdAt:desc&pagination[pageSize]=25`
    );

    if (!response.data?.data) {
      console.error("Invalid API response structure:", response);
      return [];
    }

    const processedData = response.data.data
      .map((item) => transformItem(item))
      .map(cleanItem)
      .sort((a, b) =>
        locale === "ms"
          ? a.perkataan.localeCompare(b.perkataan)
          : a.word.localeCompare(b.word)
      );

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
      categoryGroup.KumpulanKategori || `${item.Kumpulan}/${item.Kategori}`,
    groupCategory:
      categoryGroup.GroupCategory || `${item.Group}/${item.Category}`,
    word: item.Word || "",
    perkataan: item.Perkataan || "",
    video: item.Video || "",
    tag: item.Tag || "",
    new: item.New || "No",
    order: item.Order || "",
    imgStatus: item.Image_Status || "",
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