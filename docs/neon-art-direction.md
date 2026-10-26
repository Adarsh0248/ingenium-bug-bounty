# Restored four-region arena

The earlier separate-region graphics have been restored from this chat's saved source history. The overview shows four independent areas: Neon District, Ember Foundry, Verdant Circuit and Cryo Vault. A region heading or navigation button opens that area's backdrop; World map returns to the four-area overview. There is no draggable isometric city.

CyberCity.tsx draws the original scenery with SVG. WorldScenery.tsx positions the four areas. bug-art.ts and PixelBugIcon.tsx restore the earlier pixel creature families, and Arena.tsx restores their field and the visible termination effect after workbench exit. Reduced motion and keyboard question entry remain supported. The full target list is visible in every region.

This is a visual rollback. The local admin panel, question reports, score corrections, private drafts, judging and other app features remain. Authored question categories continue to determine region families across languages; existing capture receipts are retained. The 50-bounty support already being worked on is not removed. No persistent database or cloud resources were changed for this rollback.

The superseded isometric renderer, its tests and billboard asset are preserved under the ignored local directory apps/api/test-results/visual-rollback-20261026/before-restore. The original generated images also remain in the Codex generated-images directory. No Git reset, checkout, commit or push was performed.

The original scenery and pixel silhouettes are code-drawn assets. Silkscreen remains self-hosted under its existing SIL Open Font License. The historical visual references were [Kenze Wee Hon Ming's city reference](https://www.pinterest.com/pin/231091024615584818/) and [Ansimuz's city environments](https://ansimuz.itch.io/cyberpunk-street-environment); their images are not bundled.

A restoration of these graphics does not establish smooth performance on ten-year-old laptops. Real device calibration and the previously skipped event-load and endurance tests remain unverified.

Rollback verification: 24 frontend unit checks; eight focused browser checks for the restored overview, all four region backdrops, mobile navigation, private draft retention, reports, keyboard entry, graphics fallback, Monaco and delayed termination; one disposable-database admin/contestant preview check; frontend type checks, production build and bundle policy all passed. Existing Three.js clock deprecation and editor large-chunk advisories remain. No real-event load or old-device performance result is implied by these checks.
