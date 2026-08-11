import '@testing-library/jest-dom';

import { stubGisFailure } from './helpers/gis';

// Default globale: nessuna sessione Google. I test che vogliono un refresh
// riuscito chiamano stubGisToken() da tests/helpers/gis.
stubGisFailure();

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
