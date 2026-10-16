import { sanitizeDescription, searchKey } from './sanitize';

test.each([
  ['trims and collapses spaces', '  Lunch   with  Hafiz  ', 'Lunch with Hafiz'],
  ['turns tabs and newlines into one space', 'Lunch\twith\n\nHafiz', 'Lunch with Hafiz'],
  ['drops control characters', 'Lunch\u0007 with\u009F Hafiz', 'Lunch with Hafiz'],
  ['drops zero-width characters inside a word', 'Lu​nch wi‍th Ha﻿fiz', 'Lunch with Hafiz'],
  ['drops bidi overrides and isolates', '‮zifaH‬ ⁦cash⁩ ‏ok', 'zifaH cash ok'],
  ['composes to NFC', 'Café Mahsuri', 'Café Mahsuri'],
  ['keeps ordinary punctuation and emoji', "Teh tarik & roti, 2x 🍵", "Teh tarik & roti, 2x 🍵"],
])('sanitizeDescription %s', (_, raw, clean) => {
  expect(sanitizeDescription(raw)).toBe(clean);
});

test('a description of only invisible characters cleans to empty, which the draft schema refuses', () => {
  expect(sanitizeDescription('​‮ ⁦')).toBe('');
});

test('searchKey lower-cases and strips accents, so "cafe" finds "Café"', () => {
  expect(searchKey('  Café  MAHSURI​ ')).toBe('cafe mahsuri');
  expect(searchKey('Grab ride to KL Sentral')).toBe('grab ride to kl sentral');
});
