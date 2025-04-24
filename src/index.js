import React, { Suspense } from "react";
import ReactDOM from "react-dom";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpApi from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

import { Store } from "./flux";
import Dispatcher from "../src/flux/dispatcher";
import readExcel from "../src/data/categories/readExcel";
import readExcelGroup from "../src/data/categories/readExcelGroup";
import readFeaturedVideos from "./data/readFeaturedVideos";
import UnderMaintenance from "./views/UnderMaintenance";

// Conditional loading based on route
const shouldLoadFullData = () => {
  return window.location.pathname !== '/' && window.location.pathname !== '/home';
};

// Only proceed with full data loading if not on home page
if (shouldLoadFullData()) {
  // read BIM (main) sheet
  readExcel.then(
    // Promise status 200
    (value) => {
      Dispatcher.dispatch({
        actionType: "STORE_EXCEL",
        payload: value,
      });

      // read Group sheet
      readExcelGroup.then(
        // Promise status 200
        (value) => {
          Dispatcher.dispatch({
            actionType: "STORE_EXCEL_GROUP",
            payload: value,
          });

          initializeI18nAndRenderApp();
        },
        // Promise status 400
        (error) =>
          ReactDOM.render(
            <Suspense fallback="Loading">
              <UnderMaintenance />
            </Suspense>,
            document.getElementById("root")
          )
      );
    },
    // Promise status 400
    (error) =>
      ReactDOM.render(
        <Suspense fallback="Loading">
          <UnderMaintenance />
        </Suspense>,
        document.getElementById("root")
      )
  );
} else {
  // If on home page, just initialize i18n and render the app without loading all data
  initializeI18nAndRenderApp(false);
}

function initializeI18nAndRenderApp(loadFullData = true) {
  i18n
    .use(initReactI18next)
    .use(LanguageDetector)
    .use(HttpApi)
    .init({
      supportedLngs: ["en", "ms"],
      fallbackLng: "en",
      detection: {
        order: ["path", "cookie", "htmlTag", "localStorage", "subdomain"],
        caches: ["cookie"],
      },
      backend: { loadPath: "/assets/locales/{{lng}}/translation.json" },
      interpolation: {
        escapeValue: false,
      },
    });

  // Only add translations if we've loaded the full data
  if (loadFullData) {
    //Add Sign Groups & Categories Translations to namespace: 'group-category'
    Store.getCategories().map((group) => {
      i18n.addResourceBundle("en", "group-category", {
        [Store.formatString(group.category)]: group.category,
        [Store.formatString(group.group)]: group.group,
      });
      i18n.addResourceBundle("ms", "group-category", {
        [Store.formatString(group.category)]: group.kategori,
        [Store.formatString(group.group)]: group.kumpulan,
      });
      return i18n;
    });

    //Add Sign Words Translation to namespace: 'word'
    Store.getVocabsItems().map((group) => {
      i18n.addResourceBundle("en", "word", {
        [Store.formatString(group.word)]: group.word,
      });
      i18n.addResourceBundle("ms", "word", {
        [Store.formatString(group.word)]: group.perkataan,
      });
      return i18n;
    });
  }

  // Add translation for Browse by Category and Alphabet
  i18n.addResourceBundle("en", "group-category", {
    "groups": "Categories",
  });
  i18n.addResourceBundle("ms", "group-category", {
    "groups": "Kategori-Kategori",
  });
  i18n.addResourceBundle("en", "group-category", {
    "alphabets": "Alphabets",
  });
  i18n.addResourceBundle("ms", "group-category", {
    "alphabets": "Abjad",
  });

  // Load featured videos and render app
  readFeaturedVideos.then(
    // Promise status 200
    (value) => {
      Dispatcher.dispatch({
        actionType: "STORE_FEATURED_VIDEOS",
        payload: value,
      });

      ReactDOM.render(
        <Suspense fallback="Loading">
          <App />
        </Suspense>,
        document.getElementById("root")
      );
    },
    // Promise status 400
    (error) =>
      ReactDOM.render(
        <Suspense fallback="Loading">
          <UnderMaintenance />
        </Suspense>,
        document.getElementById("root")
      )
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
