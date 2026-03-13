import { Store } from "../../flux";
import { loadStaticVocabData } from "./staticVocabClient";

// Cache mechanism
const categoryCache = new Map();
const categoryCacheTimestamps = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export { categoryCache, categoryCacheTimestamps };

// Utility functions
const formatString = (str) => Store.formatString(str);

// In-flight request deduplication — prevents parallel components from
// firing the same API call simultaneously
const inFlightRequests = new Map();

// Get categories of a group
export const getCategoriesOfGroup = (group) => {
  if (!group) {
    console.warn("No group provided to getCategoriesOfGroup");
    return [];
  }

  if (formatString(group) === formatString("New Signs")) {
    return Store.getNewSigns();
  }

  return Store.getCategoriesOfGroup(group);
};

// Normalise group/category strings coming from URL params or user input
const normaliseParam = (str) =>
  str
    .replace(/-/g, ' ')
    .replace(/-&-/g, ' & ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

// Fetch vocabs by category from the static dataset
export const fetchVocabsByCategoryFromAPI = async (group, category) => {
  if (!group || !category) return [];

  try {
    const finalGroup = normaliseParam(group);
    const finalCategory = normaliseParam(category);
    const groupCategoryPair = `${finalGroup}/${finalCategory}`;

    console.log(
      `Fetching vocabs from static dataset for group/category: ${groupCategoryPair}`
    );

    const allItems = await loadStaticVocabData();

    const filtered = allItems
      .filter((item) => item.groupCategory === groupCategoryPair)
      .sort((a, b) => {
        const aOrder = a.order ?? Infinity;
        const bOrder = b.order ?? Infinity;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.perkataan || "").localeCompare(b.perkataan || "");
      });

    return filtered;
  } catch (error) {
    console.error("Error fetching vocabs by category:", error);
    return [];
  }
};

// Get vocabs by category with caching + request deduplication
export const getVocabsByCategory = async (group, category) => {
  if (!group || !category) return [];

  if (formatString(group) === formatString("new-signs")) {
    return getNewSigns();
  }

  const cacheKey = `${formatString(group)}/${formatString(category)}`;
  const now = Date.now();

  // Return valid cache immediately
  if (
    categoryCache.has(cacheKey) &&
    categoryCacheTimestamps.has(cacheKey) &&
    now - categoryCacheTimestamps.get(cacheKey) < CACHE_DURATION
  ) {
    console.log(`Using cached data for category: ${cacheKey}`);
    return categoryCache.get(cacheKey);
  }

  // Deduplicate concurrent requests for the same category
  if (inFlightRequests.has(cacheKey)) {
    console.log(`Reusing in-flight request for category: ${cacheKey}`);
    return inFlightRequests.get(cacheKey);
  }

  console.log(`Cache miss for category: ${cacheKey}, fetching from API`);

  const requestPromise = fetchVocabsByCategoryFromAPI(group, category)
    .then((vocabs) => {
      categoryCache.set(cacheKey, vocabs);
      categoryCacheTimestamps.set(cacheKey, Date.now());
      return vocabs;
    })
    .catch((error) => {
      console.error("Error in getVocabsByCategory:", error);

      if (categoryCache.has(cacheKey)) {
        console.log(`Using expired cache for category: ${cacheKey}`);
        return categoryCache.get(cacheKey);
      }

      console.log("Falling back to Store data for category vocabs");
      return Store.getVocabList(group, formatString(category));
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

// Get new signs with caching
export const getNewSigns = async () => {
  const cacheKey = "new-signs";
  const now = Date.now();

  if (
    categoryCache.has(cacheKey) &&
    categoryCacheTimestamps.has(cacheKey) &&
    now - categoryCacheTimestamps.get(cacheKey) < CACHE_DURATION
  ) {
    console.log("Using cached data for new signs");
    return categoryCache.get(cacheKey);
  }

  try {
    console.log("Cache miss for new signs, reading from static dataset");
    const allItems = await loadStaticVocabData();

    const newSigns = allItems.filter(
      (item) => (item.new || "").toLowerCase() === "yes"
    );

    categoryCache.set(cacheKey, newSigns);
    categoryCacheTimestamps.set(cacheKey, now);

    return newSigns;
  } catch (error) {
    console.error("Error in getNewSigns:", error);

    if (categoryCache.has(cacheKey)) {
      console.log("Using expired cache for new signs");
      return categoryCache.get(cacheKey);
    }

    console.log("Falling back to Store data for new signs");
    return Store.getNewSigns();
  }
};

// Clear category cache
export const clearCategoryCache = (group = null, category = null) => {
  if (group && category) {
    const cacheKey = `${formatString(group)}/${formatString(category)}`;
    categoryCache.delete(cacheKey);
    categoryCacheTimestamps.delete(cacheKey);
    console.log(`Cache cleared for category: ${cacheKey}`);
  } else if (group === "new-signs") {
    categoryCache.delete("new-signs");
    categoryCacheTimestamps.delete("new-signs");
    console.log("New signs cache cleared");
  } else {
    categoryCache.clear();
    categoryCacheTimestamps.clear();
    console.log("All category caches cleared");
  }
};