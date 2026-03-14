// Selective fields — only fetch what SOTD actually renders
const FIELD_PARAMS =
  "fields[0]=Word&fields[1]=Perkataan&fields[2]=Video&fields[3]=Tag" +
  "&fields[4]=Image_Status&fields[5]=Video_Status" +
  "&populate[category_group][fields][0]=KumpulanKategori&populate[category_group][fields][1]=GroupCategory";

const BASE_URL = "https://bimsignbank-strapi.onrender.com/api/bims";

function getSeededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function formatDateToSeed(date = new Date()) {
  return parseInt(date.toISOString().split("T")[0].replace(/-/g, ""), 10);
}

async function getTotalEntries() {
  const res = await fetch(`${BASE_URL}?pagination[page]=1&pagination[pageSize]=1`);
  const json = await res.json();
  return json.meta?.pagination?.total ?? 0;
}

async function fetchPageEntries(pageNum, pageSize) {
  const res = await fetch(
    `${BASE_URL}?${FIELD_PARAMS}&pagination[page]=${pageNum}&pagination[pageSize]=${pageSize}`
  );
  const json = await res.json();
  const data = json.data || [];
  return data.map((entry) => entry.attributes || entry);
}

export async function getSignOfTheDayLightweight() {
  const pageSize = 25;
  const seed = formatDateToSeed();
  const totalEntries = await getTotalEntries();
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));

  const pageSeed = getSeededRandom(seed);
  const pageNum = Math.min(Math.floor(pageSeed * totalPages) + 1, totalPages);

  const entries = await fetchPageEntries(pageNum, pageSize);

  const validEntries = entries.filter(
    (e) => e?.Video_Status === "Published" && e?.Video
  );

  if (validEntries.length === 0) {
    console.warn("No valid SOTD entries found on page:", pageNum);
    return null;
  }

  const indexSeed = getSeededRandom(seed + 1);
  const index = Math.floor(indexSeed * validEntries.length);
  const selected = validEntries[index];

  const cg = selected.category_group?.data?.attributes || selected.category_group || {};

  return {
    word: selected.Word || "",
    perkataan: selected.Perkataan || "",
    video: selected.Video || "",
    tag: selected.Tag || "",
    category: cg.KumpulanKategori || "",
    group: cg.GroupCategory || "",
    imgStatus: selected.Image_Status || "",
  };
}
