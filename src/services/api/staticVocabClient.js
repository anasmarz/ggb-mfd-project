import axios from "axios";

// Static dataset endpoint (served from CRA public/ by the CDN)
const STATIC_VOCAB_URL = "/vocab.json";

let staticVocabCache = null;

export const loadStaticVocabData = async () => {
  if (staticVocabCache) return staticVocabCache;

  try {
    const response = await axios.get(STATIC_VOCAB_URL);

    if (!Array.isArray(response.data)) {
      console.error("Invalid static vocab.json structure:", response.data);
      staticVocabCache = [];
      return staticVocabCache;
    }

    staticVocabCache = response.data;
    console.log(
      `[staticVocabClient] Loaded ${staticVocabCache.length} vocab items from static dataset`
    );
    return staticVocabCache;
  } catch (err) {
    console.error("[staticVocabClient] Error loading static vocab.json:", err);
    staticVocabCache = [];
    return staticVocabCache;
  }
};

export const resetStaticVocabCache = () => {
  staticVocabCache = null;
};

