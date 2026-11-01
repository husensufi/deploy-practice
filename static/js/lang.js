/*
  lang.js
  -------
  This one small file makes EVERY page multilingual.

  How it works:
  1. Every text element in the HTML gets a  data-i18n="some_key"  attribute
     instead of hardcoded text.
  2. When the page loads, we ask the server for the JSON dictionary of the
     selected language:   GET /api/translations/en   (or hi / kn)
  3. We loop through every element with data-i18n and put the matching
     translated text inside it.
  4. The chosen language is remembered in localStorage, so it stays the
     same next time the user visits.

  You do NOT need to touch this file when you add new pages later —
  just add data-i18n="key_name" to any tag, and add that key to the
  three JSON files in static/locales/.
*/

async function applyLanguage(lang) {
  const response = await fetch(`/api/translations/${lang}`);
  const dict = await response.json();

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      // For inputs/buttons we set the placeholder or value,
      // for everything else we set the visible text.
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
        el.setAttribute("placeholder", dict[key]);
      } else {
        el.textContent = dict[key];
      }
    }
  });

  localStorage.setItem("pcos_lang", lang);

  // Highlight the active language button, if language buttons exist
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
}

function initLanguage() {
  const savedLang = localStorage.getItem("pcos_lang") || "en";
  applyLanguage(savedLang);

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
  });
}

document.addEventListener("DOMContentLoaded", initLanguage);
