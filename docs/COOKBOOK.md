# App Store Connect MCP — Cookbook

> Companion reference for LLM consumers of this MCP. Load this BEFORE first use of `execute` or `search` tools. Without this doc, common failure modes (silent pagination truncation, missed enum states, response bloat) recur on every fresh session.

## How to use this cookbook

Three sections, in order of how often you'll need them:

1. **Pagination contract** — every list endpoint is paginated. Single most common failure mode.
2. **Enum tables** — `eventState`, `appStoreState`, etc. Knowing the full set prevents wrong-filter analysis.
3. **Pitfalls** — gzipped reports, rejected `sort` params, response bloat, deceptive nesting.

Worked recipes at the end. Recipes assume you've read the contracts.

---

## 1. Pagination Contract

### The bug to avoid

```js
// WRONG — returns one page, looks complete, silently isn't
const res = await api.request({
  method: 'GET',
  path: '/v1/apps/1661709494/appEvents',
  params: { limit: '30' }
});
return res.data.length; // → 30, but actual total = 40
```

The response contains `links.next` when more pages exist. If you don't check it, you ship wrong analysis.

### The contract

| If you expect | Use this pattern |
|---|---|
| Single resource (`/v1/apps/{id}`) | `api.request()` — no pagination concern |
| List, ≤200 results expected | `api.request()` with `params.limit: '200'`, then **check `res.links?.next`** — if present, you missed some |
| List, unknown or >200 results | Paginate manually via `links.next` URL with a hard page cap (e.g. 50 pages) AND a reason why you need all of them |
| List, streaming / early-exit pattern | Paginate manually, break when you find what you need |

### Manual pagination pattern

```js
const all = [];
let cursor = null;
const MAX_PAGES = 50; // hard cap — avoid runaway

for (let page = 0; page < MAX_PAGES; page++) {
  const params = { limit: '200' };
  if (cursor) params.cursor = cursor;

  const res = await api.request({
    method: 'GET',
    path: '/v1/apps/' + appId + '/appEvents',
    params: params
  });

  for (const item of (res.data || [])) all.push(item);

  if (!res.links?.next) break;
  // Extract cursor from links.next URL
  const m = res.links.next.match(/cursor=([^&]+)/);
  if (!m) break;
  cursor = decodeURIComponent(m[1]);
}
```

### Discoverability check

When in doubt, after one `api.request()` call, return or check `Boolean(res.links?.next)`. If true, you have more data than you've seen.

---

## 2. Enum Tables (the ones that bite)

These enums aren't documented in human-readable form in the OpenAPI spec — you have to query `search()` to find them. Common ones cached here.

### `eventState` (In-App Events)

| Value | Meaning | When you see it |
|---|---|---|
| `DRAFT` | Created but never published | WIP — may or may not have a schedule |
| `READY_FOR_SALE` | Published, scheduled, NOT yet started | Future event |
| `READY_FOR_REVIEW` | Submitted to Apple review | Transient |
| `IN_REVIEW` | Apple reviewing | Transient |
| `REJECTED` | Apple rejected | Needs fix |
| `ACCEPTED` | Apple approved, awaiting start | Future event |
| `PUBLISHED` | Currently LIVE on App Store | The one you usually want |
| `PAST` | Was live, event window has ended | **AUTO-transitioned by Apple at `eventEnd`** |
| `ARCHIVED` | Manually removed from view | Team cleanup |

**Critical discriminator**: `PAST` ≠ `ARCHIVED`. `PAST` is what Apple auto-sets when a scheduled event finishes. `ARCHIVED` is what the team manually sets to hide old events. **Filtering on `ARCHIVED` alone will miss recently-ended events that are still in `PAST` state.** Default to checking both, plus `READY_FOR_SALE`/`ACCEPTED`/`PUBLISHED` for "anything not in DRAFT or REJECTED."

### `appStoreState` (App Store Versions)

| Value | Meaning |
|---|---|
| `DEVELOPER_REMOVED_FROM_SALE` | Team pulled the version |
| `DEVELOPER_REJECTED` | Team rejected own submission |
| `IN_REVIEW` | Apple reviewing |
| `INVALID_BINARY` | Build issue |
| `METADATA_REJECTED` | Apple rejected metadata |
| `PENDING_APPLE_RELEASE` | Approved, Apple holding |
| `PENDING_CONTRACT` | Legal/contract gate |
| `PENDING_DEVELOPER_RELEASE` | Approved, team holds release |
| `PREPARE_FOR_SUBMISSION` | Draft state |
| `PROCESSING_FOR_APP_STORE` | Build being processed |
| `READY_FOR_REVIEW` | Submitted |
| `READY_FOR_SALE` | Live |
| `REJECTED` | Apple rejected |
| `REMOVED_FROM_SALE` | Apple pulled |
| `REPLACED_WITH_NEW_VERSION` | Superseded |
| `WAITING_FOR_EXPORT_COMPLIANCE` | Compliance gate |
| `WAITING_FOR_REVIEW` | Queued for review |

The version currently visible to users is in `READY_FOR_SALE`. Multiple versions can exist simultaneously in different states.

### Other enums worth knowing

| Resource | Field | Common values |
|---|---|---|
| `customerReviews` | `rating` | 1-5 (integer) |
| `customerReviews` | `territory` | ISO 3-letter (USA, FRA, JPN, ...) |
| `appEvents` | `priority` | `HIGH`, `NORMAL` |
| `appEvents` | `badge` | `LIVE_EVENT`, `MAJOR_UPDATE`, `NEW_SEASON`, `SPECIAL_EVENT`, `PREMIERE` |
| `appEvents` | `purpose` | `APPROPRIATE_FOR_ALL_USERS`, `APPROPRIATE_FOR_CURRENT_USERS` |
| `appStoreVersionExperimentsV2` | `state` | `PREPARE_FOR_SUBMISSION`, `READY_FOR_REVIEW`, `IN_REVIEW`, `ACCEPTED`, `REJECTED`, `RUNNING`, `STOPPED`, `COMPLETED` |

When you encounter an enum value not in this table, query the spec via `search()` and add it to this table.

---

## 3. Pitfalls

### Pitfall 1: Reports endpoints return gzipped binary

Endpoints with `/reports/` or `/finance/` in the path return gzipped responses. The client auto-decompresses these (see `src/api/client.ts` request handler). You'll get a string back, not parsed JSON. Parse it yourself if needed.

### Pitfall 2: `sort` param rejected on some endpoints

```js
// FAILS with 400 — "The parameter 'sort' can not be used with this request"
api.request({ path: '/v1/apps/{id}/customerReviews', params: { sort: '-createdDate' }});
```

Not all collection endpoints support `sort`. When you get this 400, drop the param and sort client-side after fetching.

### Pitfall 3: Territory schedules embed 170 country codes

Endpoints like `/v1/appEvents/{id}` return objects with `territorySchedules[].territories` = array of ~170 ISO country codes (one per supported region). A single event's full response can be 10-20KB. 30 events × territory schedules = 300-600KB. **Hits the sandbox 40K output truncation limit silently.**

Mitigations:
- Use `fields[appEvents]=territorySchedules,eventState,referenceName` to drop noisy fields
- Collapse `territories[]` to `territoryCount` client-side before returning from sandbox
- Paginate at smaller page sizes (limit=20)

### Pitfall 4: `customProductPages` URL pattern is NOT under `/v1/apps/{id}/customProductPages`

The endpoint exists but at a different path. Use `search()` to discover the correct path:

```js
const matches = Object.entries(spec.paths)
  .filter(([p]) => p.toLowerCase().includes('customproductpage'));
return matches.map(([p]) => p);
```

This is a recurring "Resource not found" cause.

### Pitfall 5: `appStoreVersions` default sort is undocumented

`/v1/apps/{id}/appStoreVersions` returns versions in some order that isn't `createdDate` desc. To get latest first, you must filter by state or sort client-side. The `sort` query param is rejected on this endpoint (see Pitfall 2).

### Pitfall 6: `appEvents` has no `createdDate` or `archivedDate` field

You can list events and see their state, but you CANNOT directly query "when was this event created." To reconstruct the timeline, pull `territorySchedules[].publishStart` and `eventStart`/`eventEnd` from each event. Those date fields ARE on the schedule subdocument.

### Pitfall 7: Sandbox output truncation at 40K chars

The MCP executor caps each tool invocation's serialized result at 40,000 characters. Larger payloads are cut mid-stream, often producing invalid JSON in the LLM's view. If you're pulling list data with rich subdocuments, narrow your field selection or paginate. See Pitfall 3 above.

### Pitfall 8: `customerReviews` rating is integer, not enum

The `rating` field is `1`, `2`, `3`, `4`, or `5` as integers — not `"FIVE_STAR"` etc. Compare numerically.

---

## 4. Worked Recipes

### Recipe A: Full event timeline (the May 19 bug-origin scenario)

```js
// Paginate all events, then pull schedules to reconstruct dates.
// Sequential by design for readability — for >20 events, parallelize the
// second loop with Promise.all(all.map(e => api.request({...})))
const appId = '<YOUR_APP_ID>'; // e.g. from /v1/apps list
const all = [];
let cursor = null;
const MAX_PAGES = 50; // matches §1 pagination pattern

for (let page = 0; page < MAX_PAGES; page++) {
  const params = { limit: '50' };
  if (cursor) params.cursor = cursor;
  const res = await api.request({
    method: 'GET',
    path: '/v1/apps/' + appId + '/appEvents',
    params
  });
  for (const e of (res.data || [])) all.push(e);
  if (!res.links?.next) break;
  const m = res.links.next.match(/cursor=([^&]+)/);
  if (!m) break;
  cursor = decodeURIComponent(m[1]);
}

// Now pull schedules — use fields filter to reduce response bloat
const timeline = [];
for (const e of all) {
  const d = await api.request({
    method: 'GET',
    path: '/v1/appEvents/' + e.id,
    params: { 'fields[appEvents]': 'territorySchedules,archivedTerritorySchedules,eventState,referenceName' }
  });
  const a = d.data.attributes;
  const scheds = [...(a.territorySchedules || []), ...(a.archivedTerritorySchedules || [])];
  const ends = scheds.map(s => s.eventEnd).filter(Boolean).sort();
  timeline.push({
    name: a.referenceName,
    state: a.eventState,
    lastEnd: ends[ends.length - 1] || null
  });
}

// Sort by lastEnd descending
timeline.sort((a, b) => (b.lastEnd || '').localeCompare(a.lastEnd || ''));
return JSON.stringify(timeline.slice(0, 10), null, 2); // top 10 most recent
```

### Recipe B: Active PPO experiments + lift

```js
const appId = '<YOUR_APP_ID>';
const r = await api.request({
  method: 'GET',
  path: '/v1/apps/' + appId + '/appStoreVersionExperimentsV2',
  params: { limit: '50' }
});
const active = (r.data || []).filter(e => e.attributes.state === 'RUNNING');
return active.map(e => ({
  id: e.id,
  name: e.attributes.name,
  traffic: e.attributes.trafficProportion,
  started: e.attributes.startDate?.slice(0, 10)
}));
```

### Recipe C: Recent customer reviews (without `sort` param)

```js
// 'sort' rejected on this endpoint — pull a window then sort client-side
const appId = '<YOUR_APP_ID>';
const r = await api.request({
  method: 'GET',
  path: '/v1/apps/' + appId + '/customerReviews',
  params: { limit: '200' }
});
const recent = (r.data || [])
  .map(rev => ({
    date: rev.attributes.createdDate?.slice(0, 10),
    rating: rev.attributes.rating,
    territory: rev.attributes.territory,
    title: rev.attributes.title
  }))
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  .slice(0, 20);
return recent;
```

### Recipe D: App listing creative age check

```js
// Pull latest version's screenshots + preview video + check upload dates.
// Sequential nested fetches for clarity — for production, parallelize the
// per-preview-set loop with Promise.all().
const appId = '<YOUR_APP_ID>';
const versions = await api.request({
  method: 'GET',
  path: '/v1/apps/' + appId + '/appStoreVersions',
  params: { limit: '5' }
});
const live = versions.data.find(v => v.attributes.appStoreState === 'READY_FOR_SALE');

const locs = await api.request({
  method: 'GET',
  path: '/v1/appStoreVersions/' + live.id + '/appStoreVersionLocalizations'
});
const enUS = locs.data.find(l => l.attributes.locale === 'en-US');

const previews = await api.request({
  method: 'GET',
  path: '/v1/appStoreVersionLocalizations/' + enUS.id + '/appPreviewSets'
});

const ages = [];
for (const ps of (previews.data || [])) {
  const prevs = await api.request({
    method: 'GET',
    path: '/v1/appPreviewSets/' + ps.id + '/appPreviews'
  });
  for (const p of (prevs.data || [])) {
    ages.push({
      previewType: ps.attributes.previewType,
      fileName: p.attributes.fileName,
      uploaded: p.attributes.uploadedDate?.slice(0, 10)
    });
  }
}
return ages;
```

---

## Sister MCP

For Apple Search Ads (different platform — paid acquisition ads, not the App Store storefront), use the `asa-mcp` server and its companion `asa-mcp-cookbook`. Same code-mode design, different API surface.

---

## Contributing

Found a pitfall not listed here? An enum value missing from the tables? A recipe you wish you'd had?

Add it. Cookbooks improve through consumer usage. PR the addition with a one-line context: "Hit on YYYY-MM-DD trying to <task>."

---

*Lineage: see `docs/RFC-001-pagination-truncation-cookbook.md` for the decision trail. Cookbook updates land via PR — git log is the timeline.*
