import { Trip } from '../types/trip';

const store = new Map<string, Trip>();

export const tripStore = {
  get: (id: string): Trip | undefined => store.get(id),
  set: (id: string, trip: Trip): void => { store.set(id, trip); },
  has: (id: string): boolean => store.has(id),
  delete: (id: string): boolean => store.delete(id),
  all: (): Trip[] => Array.from(store.values()),
};
