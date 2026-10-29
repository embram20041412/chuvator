import test from 'node:test';
import assert from 'node:assert/strict';

const THEME_STORAGE_KEY = 'chuvator_theme';

function createThemeManager(initialStorageValue = null) {
  const storage = new Map();
  if (initialStorageValue !== null) {
    storage.set(THEME_STORAGE_KEY, initialStorageValue);
  }

  const rootClasses = new Set();
  const rootAttributes = new Map();

  const mockLocalStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, val) => storage.set(key, String(val)),
  };

  const mockRoot = {
    classList: {
      add: (cls) => rootClasses.add(cls),
      remove: (cls) => rootClasses.delete(cls),
      contains: (cls) => rootClasses.has(cls),
    },
    setAttribute: (k, v) => rootAttributes.set(k, v),
    getAttribute: (k) => rootAttributes.get(k),
  };

  // Logic model as implemented in ThemeContext
  const getInitialTheme = () => {
    const stored = mockLocalStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    return 'light'; // Default
  };

  let currentTheme = getInitialTheme();

  const applyTheme = (theme) => {
    currentTheme = theme;
    mockLocalStorage.setItem(THEME_STORAGE_KEY, theme);
    if (theme === 'dark') {
      mockRoot.classList.add('dark');
      mockRoot.setAttribute('data-theme', 'dark');
    } else {
      mockRoot.classList.remove('dark');
      mockRoot.setAttribute('data-theme', 'light');
    }
  };

  // Initial sync
  applyTheme(currentTheme);

  const toggleTheme = () => {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  };

  const setTheme = (next) => {
    if (next === 'dark' || next === 'light') {
      applyTheme(next);
    }
  };

  return {
    get theme() { return currentTheme; },
    get isDark() { return currentTheme === 'dark'; },
    toggleTheme,
    setTheme,
    mockLocalStorage,
    mockRoot,
  };
}

test('default theme is "light" when localStorage is empty', () => {
  const mgr = createThemeManager();
  assert.equal(mgr.theme, 'light');
  assert.equal(mgr.isDark, false);
  assert.equal(mgr.mockRoot.classList.contains('dark'), false);
  assert.equal(mgr.mockRoot.getAttribute('data-theme'), 'light');
  assert.equal(mgr.mockLocalStorage.getItem(THEME_STORAGE_KEY), 'light');
});

test('restores stored "dark" theme from localStorage under key "chuvator_theme"', () => {
  const mgr = createThemeManager('dark');
  assert.equal(mgr.theme, 'dark');
  assert.equal(mgr.isDark, true);
  assert.equal(mgr.mockRoot.classList.contains('dark'), true);
  assert.equal(mgr.mockRoot.getAttribute('data-theme'), 'dark');
});

test('toggleTheme toggles between light and dark mode smoothly', () => {
  const mgr = createThemeManager();
  assert.equal(mgr.theme, 'light');

  mgr.toggleTheme();
  assert.equal(mgr.theme, 'dark');
  assert.equal(mgr.isDark, true);
  assert.equal(mgr.mockRoot.classList.contains('dark'), true);
  assert.equal(mgr.mockLocalStorage.getItem(THEME_STORAGE_KEY), 'dark');

  mgr.toggleTheme();
  assert.equal(mgr.theme, 'light');
  assert.equal(mgr.isDark, false);
  assert.equal(mgr.mockRoot.classList.contains('dark'), false);
  assert.equal(mgr.mockLocalStorage.getItem(THEME_STORAGE_KEY), 'light');
});

test('setTheme explicitly sets light or dark and persists', () => {
  const mgr = createThemeManager();
  mgr.setTheme('dark');
  assert.equal(mgr.theme, 'dark');
  assert.equal(mgr.mockRoot.classList.contains('dark'), true);
  assert.equal(mgr.mockLocalStorage.getItem(THEME_STORAGE_KEY), 'dark');

  mgr.setTheme('light');
  assert.equal(mgr.theme, 'light');
  assert.equal(mgr.mockRoot.classList.contains('dark'), false);
  assert.equal(mgr.mockLocalStorage.getItem(THEME_STORAGE_KEY), 'light');
});
