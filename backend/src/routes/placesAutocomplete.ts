import { Router, Request, Response } from 'express';
import { Client } from '@googlemaps/google-maps-services-js';
import { env } from '../config/env';
import { appConfig } from '../config/appConfig';

const router = Router();
const mapsClient = new Client({});

/** Static suggestions returned in mock mode (no API key needed). */
const MOCK_SUGGESTIONS = [
  { description: 'Times Square, New York, NY, USA',            placeId: 'mock_times_square'      },
  { description: 'Central Park, New York, NY, USA',            placeId: 'mock_central_park'       },
  { description: 'Brooklyn Bridge, New York, NY, USA',         placeId: 'mock_brooklyn_bridge'    },
  { description: 'Empire State Building, New York, NY, USA',   placeId: 'mock_empire_state'       },
  { description: 'Grand Central Terminal, New York, NY, USA',  placeId: 'mock_grand_central'      },
];

/**
 * GET /places/autocomplete?input=<text>
 *
 * Returns up to 5 place suggestions matching the user's partial input.
 * In mock mode returns a static list filtered by the input text.
 */
router.get('/', async (req: Request, res: Response) => {
  const input = (req.query.input as string | undefined)?.trim();

  if (!input || input.length < 2) {
    return res.json({ predictions: [] });
  }

  // ── Mock mode ─────────────────────────────────────────────────────────────
  if (appConfig.USE_MOCK_MODE) {
    const lower = input.toLowerCase();
    const filtered = MOCK_SUGGESTIONS.filter((s) =>
      s.description.toLowerCase().includes(lower),
    );
    return res.json({ predictions: filtered.length ? filtered : MOCK_SUGGESTIONS.slice(0, 3) });
  }

  // ── Real mode: call Google Places Autocomplete ────────────────────────────
  console.log(`[SafeWalk] Autocomplete request for: "${input}"`);
  try {
    const response = await mapsClient.placeAutocomplete({
      params: {
        input,
        key: env.GOOGLE_MAPS_API_KEY,
        // Bias results toward any location — no strict bounding box so it
        // works worldwide (user could be anywhere).
      },
    });

    const predictions = (response.data.predictions ?? []).slice(0, 5).map((p) => ({
      description: p.description,
      placeId: p.place_id,
    }));

    return res.json({ predictions });
  } catch (err) {
    console.error('[SafeWalk] Places Autocomplete failed:', err);
    // Return empty list on failure — autocomplete is non-critical
    return res.json({ predictions: [] });
  }
});

export default router;
