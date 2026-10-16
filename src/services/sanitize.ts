const FORMAT = /[­؜᠎​-‏‪-‮⁠-⁤⁦-⁯﻿]/g;
const WHITESPACE = /\s/g;
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;
const COMBINING_MARKS = /[̀-ͯ]/g;

export function sanitizeDescription(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(FORMAT, '')
    .replace(WHITESPACE, ' ')
    .replace(CONTROL, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export function searchKey(text: string): string {
  return sanitizeDescription(text).normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}
