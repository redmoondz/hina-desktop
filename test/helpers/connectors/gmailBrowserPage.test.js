const test = require("node:test");
const assert = require("node:assert/strict");

const LOCALES = ["ar", "de", "en", "es", "fr", "it", "ja", "pt", "ru", "zh-CN", "zh-TW"];
const KEYS = ["connectedTitle", "connectedBody", "failedTitle", "failedBody"].map(
  (name) => `connectors.gmail.browser.${name}`
);

// main.js words the page Google's sign-in ends on with these keys through
// i18nMain. A missing key would show the raw key in the user's browser.
test("the page Google's sign-in ends on is worded in every UI language", async () => {
  const { i18nMain } = await import("../../../src/helpers/i18nMain.js");

  for (const lng of LOCALES) {
    for (const key of KEYS) {
      const text = i18nMain.t(key, { lng });
      assert.notEqual(text, key, `${lng}: ${key} is missing`);
      const declared = key
        .split(".")
        .reduce(
          (value, segment) => value?.[segment],
          require(`../../../src/locales/${lng}/translation.json`)
        );
      assert.equal(text, declared, `${lng}: ${key} must be declared in this locale`);
      assert.doesNotMatch(text, /OpenWhispr/);
      // Branded replacement copy is English in every locale for this local edition.
      if (lng !== "en" && !text.includes("Hina Desktop")) {
        assert.notEqual(
          text,
          i18nMain.t(key, { lng: "en" }),
          `${lng}: ${key} falls back to English`
        );
      }
    }
    for (const key of [KEYS[0], KEYS[2]]) {
      assert.match(i18nMain.t(key, { lng }), /Gmail/, `${lng}: ${key} names Gmail`);
    }
  }
});
