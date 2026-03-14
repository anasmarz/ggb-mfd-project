import axios from "axios";
import cookies from "js-cookie";
import { Store } from "../../flux";
import { getNewSigns } from './alphabetAPI';

// Utility function to format strings
const formatString = (str) => Store.formatString(str);

// Get current locale setting from cookies (default to English)
const getCurrentLocale = () => cookies.get("i18next") || "en";

// Cache variables to avoid redundant API calls
let categoryCache = null;
let groupCache = null;

// Selective field population for category-groups — only the two fields we need
const CATEGORY_GROUP_URL =
  "https://bimsignbank-strapi.onrender.com/api/category-groups" +
  "?fields[0]=KumpulanKategori&fields[1]=GroupCategory&fields[2]=Remark" +
  "&pagination[pageSize]=200&filters[Remark][$ne]=Unpublished";

// Fetches all category data from the API in a single request
const fetchCategoryData = async () => {
  if (categoryCache) return categoryCache;

  try {
    const response = await axios.get(CATEGORY_GROUP_URL);

    if (!response.data?.data) {
      console.error("Invalid API response structure:", response);
      return [];
    }

    const rawData = response.data.data || [];
    const transformedData = rawData.map((entry) => {
      const item = entry.attributes || entry;
      return {
        KumpulanKategori: item.KumpulanKategori || "",
        GroupCategory: item.GroupCategory || "",
        Remark: item.Remark || "",
      };
    });

    categoryCache = transformedData;
    return transformedData;
  } catch (err) {
    console.error("Error fetching category data:", err);
    return [];
  }
};

// Processes raw category data to extract unique group entries
const restructureJSONGroup = (data) => {
  if (!Array.isArray(data)) {
    console.error("Invalid data structure received:", data);
    return [];
  }

  const validGroups = data
    .filter(
      (item) =>
        item &&
        typeof item.GroupCategory === "string" &&
        typeof item.KumpulanKategori === "string"
    )
    .map((item) => {
      try {
        const group = item.GroupCategory.split("/")[0]?.trim() || "";
        const kumpulan = item.KumpulanKategori.split("/")[0]?.trim() || "";

        if (!group || !kumpulan) {
          console.warn("Invalid group structure:", item);
          return null;
        }

        return {
          group,
          kumpulan,
          remark: item.Remark || "",
          groupCategory: item.GroupCategory.trim(),
          kumpulanKategori: item.KumpulanKategori.trim(),
        };
      } catch (error) {
        console.error("Error processing item:", item, error);
        return null;
      }
    })
    .filter(Boolean);

  // Deduplicate by group key
  const uniqueGroups = [];
  const seenGroups = new Set();

  validGroups.forEach((group) => {
    if (group?.group && !seenGroups.has(group.group)) {
      seenGroups.add(group.group);
      uniqueGroups.push(group);
    }
  });

  return uniqueGroups.length > 0
    ? uniqueGroups
    : [{ group: "default", kumpulan: "default", remark: null, groupCategory: "", kumpulanKategori: "" }];
};

// Return a list of unique group objects
export const getGroupList = async () => {
  if (groupCache) return groupCache;

  const data = await fetchCategoryData();
  const reconData = restructureJSONGroup(data);
  groupCache = reconData;
  return reconData;
};

// Return groups (unique)
export const getGroupItems = async () => {
  try {
    const groupData = await getGroupList();

    if (!groupData?.length) {
      console.warn("No group data available");
      return [];
    }

    return groupData
      .filter(Boolean)
      .map((obj) => ({
        group: obj.group || "",
        kumpulan: obj.kumpulan || "",
        remark: obj.remark || ""
      }));
  } catch (error) {
    console.error("Error getting group items:", error);
    return [];
  }
};

// Return groups and categories pairs (unique)
const getCategoryItems = async () => {
  try {
    const categoryData = await fetchCategoryData();

    if (!categoryData?.length) {
      console.warn("No category data available");
      return [];
    }

    return categoryData.filter(Boolean).map((obj) => {
      const group = obj.GroupCategory?.split("/")[0]?.trim() || "";
      const kumpulan = obj.KumpulanKategori?.split("/")[0]?.trim() || "";
      const category = obj.GroupCategory?.split("/")[1]?.trim() || "";
      const kategori = obj.KumpulanKategori?.split("/")[1]?.trim() || "";
      return { group, kumpulan, category, kategori, remark: obj.Remark };
    });
  } catch (error) {
    console.error("Error getting category items:", error);
    return [];
  }
};

// Get category list based on Group
export const getCategoriesOfGroup = async (lang = "ms") => {
  try {
    const currentLanguageCode = getCurrentLocale();
    const groupList = await getGroupList();
    const categoryItems = await getCategoryItems();
    const allResults = {};

    for (const groupObj of groupList) {
      const groupName = formatString(groupObj.group);

      if (groupName === formatString("New Signs")) {
        const newSignsWords = await getNewSigns();
        const words = newSignsWords.map((item) => ({
          word: item.word,
          perkataan: item.perkataan,
          new: item.new,
        }));

        words.sort((a, b) =>
          currentLanguageCode === "en"
            ? a.word.localeCompare(b.word)
            : a.perkataan.localeCompare(b.perkataan)
        );

        allResults["New Signs"] = words;
        continue;
      }

      const lookup = new Set();
      const filtered = [];

      for (const obj of categoryItems) {
        const objGroup = formatString(obj.group);
        const objCategory = formatString(obj.category);

        if (objGroup === groupName && !lookup.has(objCategory)) {
          lookup.add(objCategory);
          filtered.push({ category: obj.category, kategori: obj.kategori });
        }
      }

      filtered.sort((a, b) =>
        currentLanguageCode === "en"
          ? a.category.localeCompare(b.category)
          : a.kategori.localeCompare(b.kategori)
      );

      allResults[groupObj.group] = filtered;
    }

    return allResults;
  } catch (error) {
    console.error("Error getting categories of group:", error);
    return {};
  }
};

// Return the total number of category records fetched
export const getCategoryLength = async () => {
  const data = await fetchCategoryData();
  return data.length;
};

// Return the total number of unique groups
export const getGroupLength = async () => {
  const data = await getGroupList();
  return data.length;
};
