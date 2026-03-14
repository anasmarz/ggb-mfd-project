import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Select, { components } from "react-select";
import { useNavigate } from "react-router-dom";
import i18next from "i18next";
import { Store } from "../../../flux";

const CACHE_KEY = "searchVocabularyData";
const CACHE_TIMESTAMP_KEY = "searchVocabularyTimestamp";
const CACHE_DURATION_MS = 10 * 60 * 1000;

const SearchInput = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [openMenu, setOpenMenu] = useState(false);
  const currentLanguage = i18next.language;
  const debounceRef = useRef(null);
  const isMounted = useRef(true);

  const fetchVocabularyData = async () => {
    setLoading(true);
    try {
      const cachedData = sessionStorage.getItem(CACHE_KEY);
      const cachedTimestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);
      const now = Date.now();

      if (cachedData && cachedTimestamp && (now - parseInt(cachedTimestamp)) < CACHE_DURATION_MS) {
        const parsed = JSON.parse(cachedData);
        if (isMounted.current) setOptions(parsed);
        return;
      }

      const res = await fetch("/vocab.json");
      const vocab = await res.json();

      if (!Array.isArray(vocab)) {
        console.error("Invalid vocab.json structure");
        setOptions(Store.getSortedVocabsItems?.(currentLanguage) || []);
        return;
      }

      const transformed = vocab.map((item) => ({
        groupCategory: item.groupCategory || "",
        word: item.word || "",
        perkataan: item.perkataan || "",
      })).filter((item) => item.word || item.perkataan);

      const sorted = transformed.sort((a, b) =>
        currentLanguage === "en"
          ? (a.word || "").localeCompare(b.word || "")
          : (a.perkataan || "").localeCompare(b.perkataan || "")
      );

      sessionStorage.setItem(CACHE_KEY, JSON.stringify(sorted));
      sessionStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());

      if (isMounted.current) setOptions(sorted);
    } catch (error) {
      console.error("Search vocabulary fetch error:", error);
      setOptions(Store.getSortedVocabsItems?.(currentLanguage) || []);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleInputChange = (input, { action }) => {
    if (action !== "input-change") return;
    setSearchInput(input);
    setOpenMenu(true);
    clearTimeout(debounceRef.current);
  };

  const handleSelectChange = (selected) => {
    if (!selected) return;

    const groupCategory = ((selected.groupCategory || "").split(",")[0] || "").trim();
    const parts = groupCategory.split("/").map((p) => p.trim());
    const groupRaw = parts[0] || "";
    const categoryRaw = parts[1] || "";
    const group = Store.formatString(groupRaw);
    const category = Store.formatString(categoryRaw);
    const word = Store.formatString(selected.word || selected.perkataan || "");

    navigate(`/groups/${group}/${category}/${word}`);
    setOpenMenu(false);
  };

  useEffect(() => {
    isMounted.current = true;
    fetchVocabularyData();
    return () => {
      isMounted.current = false;
      clearTimeout(debounceRef.current);
    };
  }, [currentLanguage]);

  const Menu = (props) => <components.Menu {...props}>{props.children}</components.Menu>;

  return (
    <div className="search-bar">
      <form>
        <Select
          options={options}
          onChange={handleSelectChange}
          isLoading={loading}
          getOptionLabel={(option) => (
            <strong className="text-m-2">
              {currentLanguage === "en" ? option.word : option.perkataan}
            </strong>
          )}
          getOptionValue={(option) =>
            currentLanguage === "en" ? option.word : option.perkataan
          }
          onInputChange={handleInputChange}
          onBlur={() => setOpenMenu(false)}
          menuIsOpen={openMenu}
          value={null}
          placeholder={loading ? t("loading") : t("search_placeholder")}
          noOptionsMessage={() => (loading ? t("loading") : t("no_results"))}
          filterOption={(option, input) => {
            if (!input || input.length < 2) return true;
            const label =
              currentLanguage === "en" ? option.data.word : option.data.perkataan;
            return (label || "")
              .toLowerCase()
              .includes((input || "").toLowerCase());
          }}
          components={{ Menu }}
        />
      </form>
    </div>
  );
};

export default SearchInput;
