/**
 * Stub di Google Identity Services per i test.
 *
 * In jsdom lo script GIS non viene mai caricato (non arriva né `load` né `error`),
 * quindi senza uno stub ogni refresh silenzioso del token resterebbe appeso fino al
 * timeout. `stubGisFailure()` è il default globale (vedi tests/setup.ts).
 */

interface TokenClientConfig {
  callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void;
  error_callback?: (e: unknown) => void;
}

const install = (respond: (cfg: TokenClientConfig) => void): void => {
  (window as unknown as { google: unknown }).google = {
    accounts: {
      oauth2: {
        initTokenClient: (cfg: TokenClientConfig) => ({
          requestAccessToken: () => respond(cfg),
        }),
      },
    },
  };
};

/** GIS restituisce un access token valido (utente con sessione Google attiva). */
export const stubGisToken = (accessToken: string, expiresIn = 3600): void =>
  install(cfg => cfg.callback({ access_token: accessToken, expires_in: expiresIn }));

/** GIS non riesce a rilasciare un token (nessuna sessione Google / consenso revocato). */
export const stubGisFailure = (error = 'gis_unavailable_in_tests'): void =>
  install(cfg => cfg.callback({ error }));
