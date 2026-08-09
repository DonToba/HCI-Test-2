# HealthConnect — Presentation / WOW Build

This version extends the provider locator into a presentation-ready health-insurance operations and network-intelligence platform.

## New presentation features

### 1. Provider Locator
- Enrollee search by ID or name
- Registered-address search
- Current GPS location
- Click-on-map simulation
- Adjustable radius (250 m default)
- HMO plan filtering
- Provider-type filtering
- 250 m search visualization
- Provider markers and live counts

### 2. Recommended Provider
The interface now ranks a recommended provider using a transparent presentation score based on:
- proximity
- HMO/network compatibility
- emergency relevance
- service relevance

The card shows a match percentage and key reasons.

### 3. Smart / Natural-language search
A lightweight demo interpreter accepts phrases such as:
- "find a dental clinic within 1 km"
- "emergency hospital within 2 km"
- "find a pharmacy within 1 km"

It converts those phrases into the corresponding provider filters/radius. This is intentionally implemented without an external AI API so the demo works without API keys.

### 4. Emergency Mode
Emergency Mode:
- prioritises hospitals
- expands the search area to 5 km
- highlights emergency-oriented results
- keeps the experience focused on rapid decision support

### 5. Provider Profile
Click a provider to open a professional provider profile showing:
- category
- match score
- distance
- estimated travel time
- address
- services
- phone/email
- HMO/network status
- directions
- compare action

Travel time is an **estimated presentation value** based on straight-line distance. For production, connect a routing API to calculate actual driving/walking routes.

### 6. Provider Comparison
Staff can select up to three providers and compare:
- distance
- estimated drive time
- network eligibility
- service category

### 7. Coverage Snapshot
The right dashboard calculates the percentage of the supplied sample enrollees who have at least one provider within 250 m.

### 8. Network Intelligence
A dedicated executive view provides:
- sample enrollee coverage
- coverage gaps
- average nearest-provider distance
- provider distribution
- state/provider concentration
- members furthest from a provider
- one-click return to the locator

## Important production note

Real enrollee information should not be deployed as a public static GeoJSON file. For production, put enrollee data behind an authenticated API/database and return only authorised records.

Similarly, replace presentation estimates with a proper routing/ETA service before operational use.

## Vercel

```bash
npm install
npm run build
```

Recommended Vercel settings:
- Framework: Vite
- Build: `npm run build`
- Output: `dist`
- Install: `npm install`

No environment variables are required for this demonstration build.
