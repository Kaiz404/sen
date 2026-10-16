import { parsePref } from './prefs';

test('a stored value the schema accepts is read back', () => {
  expect(parsePref('senMotion', 'calm')).toBe('calm');
  expect(parsePref('hideAmounts', false)).toBe(false);
});

test('a corrupt or missing value reads as the documented default', () => {
  expect(parsePref('senMotion', 'wild')).toBe('full');
  expect(parsePref('hideAmounts', 'no')).toBe(true);
  expect(parsePref('demo.datasetSize', undefined)).toBe(1000);
  expect(parsePref('haptics', 'yes')).toBe(true);
});
