import axios from "axios";
import { Store } from "../../flux";

// Cache mechanism
const categoryCache = new Map();
const categoryCacheTimestamps = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export { categoryCache, categoryCacheTimestamps };

// Utility functions
const formatString = (str) => Store.formatString(str);

// Selective field population — avoids fetching unused relation data
const FIELD_PARAMS =
  "fields[0]=Word&fields[1]=Perkataan&fields[2]=Video&fields[3]=Tag&fields[4]=New&fields[5]=Order&fields[6]=Image_Status" +
  "&populate[category_group][fields][0]=KumpulanKategori&populate[category_group][fields][1]=GroupCategory";

const BASE_URL = "https://bimsignbank-strapi.onrender.com/api/bims";

// In-flight request deduplication — prevents parallel components from
// firing the same API call simultaneously
const inFlightRequests = new Map();

// Reusable transformer for vocab items
const transformVocabItem = (item) => ({
  kumpulanKategori: item.category_group?.KumpulanKategori || `${item.Kumpulan}/${item.Kategori}`,
  groupCategory: item.category_group?.GroupCategory || `${item.Group}/${item.Category}`,
  word: item.Word || '',
  perkataan: item.Perkataan || '',
  video: item.Video || '',
  tag: item.Tag || '',
  new: item.New || 'No',
  order: item.Order || '',
  imgStatus: item.Image_Status || ''
});

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

// Fetch vocabs by category — single request replacing the while-loop
export const fetchVocabsByCategoryFromAPI = async (group, category) => {
  if (!group || !category) return [];

  try {
    const finalGroup = normaliseParam(group);
    const finalCategory = normaliseParam(category);
    const groupCategoryPair = `${finalGroup}/${finalCategory}`;

    console.log(`Fetching vocabs for group/category: ${groupCategoryPair}`);

    const encodedGroupCategoryPair = encodeURIComponent(groupCategoryPair);

    const response = await axios.get(
      `${BASE_URL}?${FIELD_PARAMS}&filters[category_group][GroupCategory][$eq]=${encodedGroupCategoryPair}&pagination[pageSize]=500`
    );

    if (!response.data?.data) {
      console.error("Invalid API response structure:", response);
      return [];
    }

    const transformedData = response.data.data
      .map(transformVocabItem)
      .sort((a, b) => {
        const aOrder = a.order ?? Infinity;
        const bOrder = b.order ?? Infinity;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.perkataan.localeCompare(b.perkataan);
      });

    return transformedData;
  } catch (error) {
    console.error("Error fetching vocabs by category:", error);
    return [];
  }
};

// Fetch new signs — single targeted request
export const fetchNewSignsFromAPI = async () => {
  try {
    console.log("Fetching new signs");

    const response = await axios.get(
      `${BASE_URL}?${FIELD_PARAMS}&filters[New][$eq]=Yes&pagination[pageSize]=200`
    );

    if (!response.data?.data) {
      console.error('Invalid API response structure:', response);
      return [];
    }

    return response.data.data.map(transformVocabItem);
  } catch (error) {
    console.error("Error fetching new signs:", error);
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
    console.log("Cache miss for new signs, fetching from API");
    const newSigns = await fetchNewSignsFromAPI();

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