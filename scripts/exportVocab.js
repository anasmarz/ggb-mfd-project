const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Base Strapi API URL for BIM vocabulary entries
const STRAPI_BASE_URL =
  process.env.STRAPI_BASE_URL ||
  "https://bimsignbank-strapi.onrender.com/api/bims";

// Query parameters to match the fields used in the frontend
const FIELD_PARAMS =
  "fields[0]=Word&fields[1]=Perkataan&fields[2]=Video&fields[3]=Tag&fields[4]=New&fields[5]=Order&fields[6]=Image_Status" +
  "&populate[category_group][fields][0]=KumpulanKategori&populate[category_group][fields][1]=GroupCategory";

// Transform a raw Strapi item into the app's vocab shape
const transformItem = (item) => {
  const attrs = item || {};
  const categoryGroup = attrs.category_group || {};

  return {
    kumpulanKategori:
      categoryGroup.KumpulanKategori ||
      `${attrs.Kumpulan || ""}/${attrs.Kategori || ""}`,
    groupCategory:
      categoryGroup.GroupCategory ||
      `${attrs.Group || ""}/${attrs.Category || ""}`,
    word: attrs.Word || "",
    perkataan: attrs.Perkataan || "",
    video: attrs.Video || "",
    tag: attrs.Tag || "",
    new: attrs.New || "No",
    order: attrs.Order || "",
    imgStatus: attrs.Image_Status || "",
  };
};

// Clean line breaks and trim strings
const cleanItem = (item) => ({
  kumpulanKategori: (item.kumpulanKategori || "")
    .toString()
    .replace(/(\r\n|\n|\r)/gm, ""),
  groupCategory: (item.groupCategory || "")
    .toString()
    .replace(/(\r\n|\n|\r)/gm, ""),
  word: (item.word || "").toString().trim(),
  perkataan: (item.perkataan || "").toString().trim(),
  video: item.video || "",
  tag: item.tag || "",
  new: item.new || "No",
  order: item.order || "",
  imgStatus: item.imgStatus || "",
});

// Derive a lightweight search index from the full dataset
const buildSearchIndex = (items) =>
  items.map((item) => ({
    word: item.word,
    perkataan: item.perkataan,
    kumpulanKategori: item.kumpulanKategori,
    groupCategory: item.groupCategory,
    tag: item.tag,
  }));

async function exportVocab() {
  try {
    const pageSize = process.env.VOCAB_PAGE_SIZE || 2000;
    const url = `${STRAPI_BASE_URL}?${FIELD_PARAMS}&pagination[pageSize]=${pageSize}`;

    console.log(`[export-vocab] Fetching vocab from: ${url}`);
    const res = await axios.get(url);

    if (!res.data || !Array.isArray(res.data.data)) {
      console.error(
        "[export-vocab] Unexpected Strapi response structure:",
        res.data
      );
      process.exitCode = 1;
      return;
    }

    const rawItems = res.data.data.map((entry) => entry.attributes || entry);
    const processed = rawItems.map(transformItem).map(cleanItem);

    console.log(`[export-vocab] Processed ${processed.length} vocab entries`);

    const outputDir = path.join(__dirname, "..", "public");
    const vocabPath = path.join(outputDir, "vocab.json");
    const searchPath = path.join(outputDir, "vocab-search.json");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(vocabPath, JSON.stringify(processed, null, 2), "utf8");
    console.log(`[export-vocab] Wrote full dataset to ${vocabPath}`);

    const searchIndex = buildSearchIndex(processed);
    fs.writeFileSync(
      searchPath,
      JSON.stringify(searchIndex, null, 2),
      "utf8"
    );
    console.log(
      `[export-vocab] Wrote lightweight search index to ${searchPath}`
    );
  } catch (err) {
    console.error("[export-vocab] Failed to export vocab:", err.message);
    process.exitCode = 1;
  }
}

exportVocab();

