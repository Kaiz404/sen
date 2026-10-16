import { readPref, subscribePrefs } from '@/services/prefs';
import { applyTheme, configureThemes } from '@/theme/unistyles';

// The app entry and jest.setup import this module before any screen, so the first frame already wears the saved
// theme. From then on every write of the pref switches the live theme, sign out's clearPrefs included.
configureThemes(readPref('theme'));
subscribePrefs((key) => {
  if (key === 'theme') applyTheme(readPref('theme'));
});
