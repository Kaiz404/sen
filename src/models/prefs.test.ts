import { parsePref } from './prefs';

test('a stored value the schema accepts is read back', () => {
  expect(parsePref('senMotion', 'calm')).toBe('calm');
});

test('a corrupt or missing value reads as the documented default', () => {
  expect(parsePref('senMotion', 'wild')).toBe('full');
  expect(parsePref('demo.datasetSize', undefined)).toBe(1000);
  expect(parsePref('haptics', 'yes')).toBe(true);
});
