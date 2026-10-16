/** Format characters: soft hyphen, Arabic letter mark, zero-width, bidi marks, embeddings, overrides and isolates, BOM. */
const FORMAT = /[­؜᠎​-‏‪-‮⁠-⁤⁦-⁯﻿]/g;
const WHITESPACE = /\s/g;
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Explicit ranges instead of `\p{…}`, so the rules never depend on the engine's Unicode tables. */
export function sanitizeDescription(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(FORMAT, '')
    .replace(WHITESPACE, ' ')
    .replace(CONTROL, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** What `search_text` stores and what a query is compared with: clean, accents stripped, lower case. */
export function searchKey(text: string): string {
  return sanitizeDescription(text).normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}
