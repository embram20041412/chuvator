import test from 'node:test';
import assert from 'node:assert/strict';

// Pure logic model of the sidebar accordion state management
function createAccordionController(initialPath = '/dashboard') {
  let expandedMenu = null; // 'akademi' | 'profil' | null
  let currentPath = initialPath;

  const syncWithRoute = (pathname) => {
    currentPath = pathname;
    if (pathname.startsWith('/akademi')) {
      expandedMenu = 'akademi';
    } else if (pathname.startsWith('/pengaturan')) {
      expandedMenu = 'profil';
    } else {
      expandedMenu = null;
    }
  };

  const toggleAkademi = (navigate) => {
    if (!currentPath.startsWith('/akademi')) {
      navigate('/akademi?tab=dasbor');
      expandedMenu = 'akademi';
    } else {
      expandedMenu = expandedMenu === 'akademi' ? null : 'akademi';
    }
  };

  const toggleProfil = (navigate) => {
    if (!currentPath.startsWith('/pengaturan')) {
      navigate('/pengaturan?tab=profil');
      expandedMenu = 'profil';
    } else {
      expandedMenu = expandedMenu === 'profil' ? null : 'profil';
    }
  };

  const clickStandaloneNav = (path, navigate) => {
    navigate(path);
    expandedMenu = null;
  };

  // Run initial route sync if route was specified
  syncWithRoute(initialPath);

  return {
    get isAkademiOpen() { return expandedMenu === 'akademi'; },
    get isProfilOpen() { return expandedMenu === 'profil'; },
    get expandedMenu() { return expandedMenu; },
    syncWithRoute,
    toggleAkademi,
    toggleProfil,
    clickStandaloneNav,
  };
}

test('initial state on /dashboard has both accordions collapsed (false)', () => {
  const ctrl = createAccordionController('/dashboard');
  assert.equal(ctrl.expandedMenu, null);
  assert.equal(ctrl.isAkademiOpen, false);
  assert.equal(ctrl.isProfilOpen, false);
});

test('opening Akademi closes Profil (mutual exclusivity)', () => {
  const ctrl = createAccordionController('/dashboard');
  let navTarget = '';
  const navigate = (p) => { navTarget = p; ctrl.syncWithRoute(p); };

  ctrl.toggleAkademi(navigate);
  assert.equal(ctrl.isAkademiOpen, true);
  assert.equal(ctrl.isProfilOpen, false);
  assert.equal(ctrl.expandedMenu, 'akademi');

  // Now toggle Profil
  ctrl.toggleProfil(navigate);
  assert.equal(ctrl.isAkademiOpen, false);
  assert.equal(ctrl.isProfilOpen, true);
  assert.equal(ctrl.expandedMenu, 'profil');
});

test('toggling currently active accordion collapses it', () => {
  const ctrl = createAccordionController('/akademi?tab=dasbor');
  let navTarget = '';
  const navigate = (p) => { navTarget = p; ctrl.syncWithRoute(p); };

  assert.equal(ctrl.isAkademiOpen, true);

  // Toggle closed
  ctrl.toggleAkademi(navigate);
  assert.equal(ctrl.isAkademiOpen, false);
  assert.equal(ctrl.expandedMenu, null);

  // Toggle open again
  ctrl.toggleAkademi(navigate);
  assert.equal(ctrl.isAkademiOpen, true);
  assert.equal(ctrl.expandedMenu, 'akademi');
});

test('navigating to standalone menu (Dashboard, Kasir, etc.) collapses all accordions', () => {
  const ctrl = createAccordionController('/pengaturan?tab=profil');
  let navTarget = '';
  const navigate = (p) => { navTarget = p; ctrl.syncWithRoute(p); };

  assert.equal(ctrl.isProfilOpen, true);

  // Click Dashboard
  ctrl.clickStandaloneNav('/dashboard', navigate);
  assert.equal(ctrl.isAkademiOpen, false);
  assert.equal(ctrl.isProfilOpen, false);
  assert.equal(ctrl.expandedMenu, null);
});
