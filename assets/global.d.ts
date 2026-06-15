/**
 * Ambient declarations for the cross-file `window.*` globals used by the
 * frontend scripts in `assets/`. This app has no build step: each script is
 * loaded via a plain `<script>` tag and communicates through globals attached
 * to `window` (see `Index.html`).
 *
 * Types are intentionally loose (`any`) for now; this file only exists so
 * that `npm run typecheck` can cover `assets/**` without each script needing
 * to redeclare every cross-file global it consumes. Tightening individual
 * signatures is left for later, once `assets/**` typechecking is established.
 */

declare global {
  interface Window {
    Vue: any;
    KIROKU_RUNTIME_CONFIG: any;
    KirokuUI: any;
    KirokuScreenProjections: any;
    createKirokuApp: () => any;
    createKirokuAuth: (...args: any[]) => any;
    createKirokuNotifications: (...args: any[]) => any;
    createJudokaProfileViewModel: (...args: any[]) => any;
    createKirokuHomeScreen: (...args: any[]) => any;
    createKirokuJudokaScreen: (...args: any[]) => any;
    createKirokuCompetitionScreen: (...args: any[]) => any;
    createKirokuChildrenScreen: (...args: any[]) => any;
    createKirokuAdminsScreen: (...args: any[]) => any;
    createKirokuLoginScreen: (...args: any[]) => any;
  }
}

export {};
