# SafeWalk Backend

Trip state management and risk logic API. No frontend, no Twilio, no Maps required to run this.

## Quick Start

```bash
npm install
npm run dev
# Server starts at http://localhost:3000
```

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/start-trip` | Create a new trip, returns tripId |
| POST | `/update-location` | Send location update, returns current status |
| POST | `/check-response` | Submit user's response to a check-in prompt |
| GET | `/status/:tripId` | Full trip state snapshot |
| GET | `/health` | Health check |

---

## Risk Logic

| Status | Trigger |
|--------|---------|
| GREEN | On route, active, no issues |
| YELLOW | >50m deviation OR inactive >2min → sends check-in prompt |
| RED | >200m deviation OR inactive >5min OR no check-in response after 60s OR SOS OR danger word |

Escalation is set automatically when RED is reached via SOS, danger word, or missed check-in.

---

## Test Scenarios (curl)

### 1. Start a trip

```bash
curl -X POST http://localhost:3000/start-trip \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "destination": "Times Square",
    "trustedContact": {
      "name": "Sarah",
      "phone": "+1234567890"
    }
  }'
```

**Response:**
```json
{
  "tripId": "abc-123-...",
  "status": "GREEN",
  "destination": "Times Square",
  "route": [...],
  "message": "Trip started. Stay safe!"
}
```

---

### 2. Update location — on route (GREEN)

```bash
curl -X POST http://localhost:3000/update-location \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "YOUR_TRIP_ID",
    "lat": 40.7133,
    "lng": -74.0055
  }'
```

**Expected:** `{ "status": "GREEN", ... }`

---

### 3. Update location — moderate deviation (YELLOW)

```bash
curl -X POST http://localhost:3000/update-location \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "YOUR_TRIP_ID",
    "lat": 40.7135,
    "lng": -74.0100
  }'
```

**Expected:** `{ "status": "YELLOW", "checkInRequired": true, ... }`

---

### 4. Update location — large deviation (RED)

```bash
curl -X POST http://localhost:3000/update-location \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "YOUR_TRIP_ID",
    "lat": 40.7200,
    "lng": -74.0300
  }'
```

**Expected:** `{ "status": "RED", "escalated": true, ... }`

---

### 5. User responds OK to check-in

```bash
curl -X POST http://localhost:3000/check-response \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "YOUR_TRIP_ID",
    "response": "ok"
  }'
```

**Expected:** `{ "status": "GREEN", "escalated": false, ... }`

---

### 6. SOS triggered

```bash
curl -X POST http://localhost:3000/check-response \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "YOUR_TRIP_ID",
    "response": "sos"
  }'
```

**Expected:** `{ "status": "RED", "escalated": true, ... }`

---

### 7. Danger word triggered

```bash
curl -X POST http://localhost:3000/check-response \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "YOUR_TRIP_ID",
    "response": "danger-word"
  }'
```

**Expected:** `{ "status": "RED", "escalated": true, ... }`

---

### 8. No response to check-in (frontend-driven timeout)

```bash
curl -X POST http://localhost:3000/check-response \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "YOUR_TRIP_ID",
    "response": "no-response"
  }'
```

**Expected:** `{ "status": "RED", "escalated": true, ... }`

---

### 9. Get full trip status

```bash
curl http://localhost:3000/status/YOUR_TRIP_ID
```

**Returns:** full trip snapshot including alertLog, secondsSinceLastUpdate, checkInPending, etc.

---

## File Structure

```
backend/
├── src/
│   ├── config/
│   │   └── constants.ts       # Hardcoded route + risk thresholds
│   ├── logic/
│   │   └── riskEngine.ts      # evaluateRisk(), shouldEscalate(), haversine
│   ├── routes/
│   │   ├── startTrip.ts
│   │   ├── updateLocation.ts
│   │   ├── checkResponse.ts
│   │   └── status.ts
│   ├── store/
│   │   └── tripStore.ts       # In-memory Map (swap for DynamoDB later)
│   ├── types/
│   │   └── trip.ts            # Trip, Location, TrustedContact types
│   └── index.ts               # Express app entry
├── package.json
└── tsconfig.json
```

## What to swap when integrating with the rest of the team

| Now (mock) | Later (real) |
|---|---|
| `HARDCODED_ROUTE` in constants.ts | Google Maps Directions API response |
| `tripStore` Map | DynamoDB table |
| `alertLog` array | Twilio SMS call in `checkResponse.ts` / `updateLocation.ts` |
| Manual curl to `/check-response` with `no-response` | Frontend timer that calls this after 60s of no user tap |
