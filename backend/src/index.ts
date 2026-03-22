import './config/env';           // validates env vars and loads .env before anything else
import express from 'express';
import cors from 'cors';
import path from 'path';
import startTripRouter from './routes/startTrip';
import updateLocationRouter from './routes/updateLocation';
import checkResponseRouter from './routes/checkResponse';
import statusRouter from './routes/status';
import getRoutesRouter from './routes/getRoutes';
import placesAutocompleteRouter from './routes/placesAutocomplete';
import alertsRouter from './routes/alerts';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Allow all origins — tunnel URL changes on every restart during development
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'SafeWalk Backend', timestamp: new Date().toISOString() });
});

app.use('/routes', getRoutesRouter);
app.use('/places/autocomplete', placesAutocompleteRouter);          // Milestone 1 — real route fetching
app.use('/start-trip', startTripRouter);
app.use('/update-location', updateLocationRouter);
app.use('/check-response', checkResponseRouter);
app.use('/status', statusRouter);
app.use('/alerts', alertsRouter);

app.listen(PORT, () => {
  console.log(`SafeWalk backend running on http://localhost:${PORT}`);
});

export default app;
