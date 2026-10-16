# Artist names in analytical reports

The collector reads `name` and `slug` from the existing round `/full` response into `artistName` and `artistSlug` on each primary participant record. Identity refresh does not depend on score changes and requires no individual artist requests. Blank, missing or non-string values retain the previous value independently for each field. Removed participants retain their identity and grades in `archivedMembers`.

`normalizeData()` exposes `D.artists`: a UUID-keyed Map of `{artistName, artistSlug}` for current and archived participants. `D.metadata` and `D.referenceMetadata` remain the separate forum nickname/group directories. Equal names never identify the same participant.

New reports should use `artistIdentity(D, userId)` from `js/artist-identity.js`, or append `artistNameElement(D, userId)` to render the name safely. The element links to `https://19ib.ru/artist/{slug}`, falling back to the existing UUID URL format when slug is unknown. Known names expose the UUID in the native tooltip and accessible label. Missing names display a native «Имя неизвестно» disclosure: a click/tap or Enter reveals the full UUID and profile link. Artist names must not fall back to forum nicknames.

The existing rappers model uses artist names for its artist field/search and canonical profile links, while forum rows continue displaying forum nicknames. A new artist name replaces the old label under the same UUID, including labels in historical reports; it does not revise grades, membership or TUZ. This change does not claim to reconstruct the name at the time of an old score. That would require an independently approved name observation log.

Initial name-only enrichment preserves score export timestamps, every grade, `history.json` and the forum directory. Only `metadata.runId` changes to give the enriched JSON a fresh browser-cache URL; this is not a new score collection. Subsequent normal collections refresh names and publication metadata through the existing pipeline.
