import assert from "node:assert/strict";
import { descriptionReferencesImage } from "../features/media/public-description";
import { guessKindFromField } from "./lib/media-inventory-extract";

const key = "courses/11111111-1111-1111-1111-111111111111/lesson-image/sample.png";
const src = `/api/media/file?key=${encodeURIComponent(key)}`;
assert.equal(descriptionReferencesImage(`<img src="${src}">`, key), true);
assert.equal(descriptionReferencesImage(`<img src='${src}&amp;redirect=1'>`, key), true);
assert.equal(descriptionReferencesImage(`<img src="${src}extra">`, key), false);
assert.equal(descriptionReferencesImage(`<a href="${src}">download</a>`, key), false);
assert.equal(descriptionReferencesImage(`<img data-src="${src}">`, key), false);
assert.equal(descriptionReferencesImage(`<img src="https://other.test${src}">`, key), false);
assert.equal(descriptionReferencesImage(null, key), false);
assert.equal(guessKindFromField("courses", "description", "https://example.com/photo.png"), "promo");
assert.equal(guessKindFromField("lessons", "content", "https://example.com/photo.png"), "lesson-image");
console.log("Public course image access checks passed.");
