# Current submission materials

- [Seven-slide PDF](gaia-seven-slide-presentation.pdf)
- [Matching slide HTML](gaia-seven-slide-presentation.html)
- [Detailed BC report](bc-central-interior-report.md)
- [Complete BC evidence and numerical inputs — gzip JSON](bc-central-interior-investigation.json.gz)
- [Plan-wide feature audit and remaining boundaries](../FEATURE-AUDIT.md)

The seven-page deck introduces GAIA, its user experience, specialist functions and inspectable workspace, then gives a short completed BC demonstration. It contains a real application screenshot, the retained producer boundary and charts from NASA AppEEARS and NASA POWER artifacts—not pending work or illustrative substitute measurements. Summer temperature-grid context is reported with its nominal interval, but is not treated as a regional mean or as a cause of vegetation change. Monthly EVI remains inconclusive with substantial QA gaps; seasonal EVI is descriptive only. The Central Interior ecoprovince is an explicitly selected demonstration boundary, not every definition of Interior Plateau. Nothing here establishes forest decline, forest recovery or a cause.

The archive is lossless JSON compression (SHA-256 `42b36e6f248e414bcd590513468ff224ff59e85389365c25c98494e2847ee0ed`), preserving all eight numerical artifacts, geometry, provenance, methods and source references. Internal role-session identifiers in the narrative are redacted; scientific artifact manifests remain unchanged. It is compressed because the uncompressed regional export exceeds GitHub's single-file limit, not to omit evidence. New acquisitions still call providers afresh.

```powershell
npm run setup
npm run reproduce -- docs/submission/bc-central-interior-investigation.json.gz
```

Verified: all eight artifact analyses reproduce without network/provider access, including input/method hashes and numerical results at `1e-10`. Existing automated suite: 42 Python and 53 Node tests passed. Rune build succeeded; framework warnings remain recorded locally. The current PDF contains seven pages. These checks do not constitute independent ecological validation or confirmation of organizer submission.

The HTML embeds its fonts and images, so it opens without a server or external asset requests. Regenerate it with `node scripts/make-slides.mjs`. All seven pages were visually inspected; the current PDF has seven pages and no overflowing slide text. The older timestamped decks and legacy `slides.html`/`slides.pdf` are historical snapshots; use the current links above. Organizer upload, deadline and public project-page requirements must be confirmed by the submitting team.
