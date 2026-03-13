import { loadStaticVocabData } from "./staticVocabClient";

function getSeededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function formatDateToSeed(date = new Date()) {
  return parseInt(date.toISOString().split("T")[0].replace(/-/g, ""), 10);
}

export async function getSignOfTheDayLightweight() {
  const seed = formatDateToSeed();

  const allItems = await loadStaticVocabData();

  // Prefer entries explicitly marked as published with a video
  let validEntries = allItems.filter(
    (item) => item.video && item.videoStatus === "Published"
  );

  if (validEntries.length === 0) {
    // Fallback: allow any entry with a video so SOTD still works
    console.warn(
      "No SOTD entries with videoStatus='Published' found; falling back to any entry with a video"
    );
    validEntries = allItems.filter((item) => item.video);
  }

  if (validEntries.length === 0) {
    console.warn("No valid SOTD entries with a video found in static dataset");
    return null;
  }

  // Pick a deterministic entry from valid ones
  const indexSeed = getSeededRandom(seed + 1);
  const index = Math.floor(indexSeed * validEntries.length);
  const selected = validEntries[index];

  return {
    word: selected.word || "",
    perkataan: selected.perkataan || "",
    video: selected.video || "",
    tag: selected.tag || "",
    category: selected.kumpulanKategori || "",
    group: selected.groupCategory || "",
    imgStatus: selected.imgStatus || "",
  };
}