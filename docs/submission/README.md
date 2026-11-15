# Current submission materials

- [Seven-slide PDF](slides-live-1794732288654.pdf)
- [Matching slide HTML](slides-live-1794732288654.html)
- [Detailed BC report](bc-central-interior-report.md)
- [Complete BC evidence and numerical inputs — gzip JSON](bc-central-interior-investigation.json.gz)
- [Plan-wide feature audit and remaining boundaries](../FEATURE-AUDIT.md)

These materials include the completed original NASA AppEEARS task, not a pending extraction. The Central Interior ecoprovince is an explicitly selected demonstration boundary, not every definition of Interior Plateau. Monthly EVI is inconclusive because of QA-support gaps; the July–September derivative is descriptive-only. Neither establishes forest decline, forest recovery or a cause.

The archive is lossless JSON compression (SHA-256 `42b36e6f248e414bcd590513468ff224ff59e85389365c25c98494e2847ee0ed`), preserving all eight numerical artifacts, geometry, provenance, methods and source references. Internal role-session identifiers in the narrative are redacted; scientific artifact manifests remain unchanged. It is compressed because the uncompressed regional export exceeds GitHub's single-file limit, not to omit evidence. New acquisitions still call providers afresh.

```powershell
npm run setup
npm run reproduce -- docs/submission/bc-central-interior-investigation.json.gz
```

Verified: all eight artifact analyses reproduce without network/provider access, including input/method hashes and numerical results at `1e-10`. Existing automated suite: 42 Python and 53 Node tests passed. Rune build succeeded; framework warnings remain recorded locally. PDF contains seven pages. These checks do not constitute independent ecological validation or confirmation of organizer submission.

Older timestamped decks are historical snapshots. Use the current links above; organizer upload, deadline and public project-page requirements must be confirmed by the submitting team.
