import { useRef, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import RNMapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { decodePolyline } from '../services/api';
import type { SafetyStatus } from '../types';
import { colors } from '../constants/colors';

interface MapViewProps {
  userLocation: { lat: number; lng: number } | null;
  destination:  { lat: number; lng: number } | null;
  routePolyline?: string;
  safetyStatus?: SafetyStatus;
}

/** Colour of the route line based on current safety status */
function routeColor(status: SafetyStatus | undefined): string {
  if (status === 'risk')      return '#EF4444'; // red
  if (status === 'uncertain') return '#F59E0B'; // amber
  return '#3B82F6';                             // blue (safe / default)
}

export default function MapView({
  userLocation,
  destination,
  routePolyline,
  safetyStatus,
}: MapViewProps) {
  const mapRef = useRef<RNMapView>(null);

  // Decode encoded polyline → LatLng coordinates for the Polyline overlay
  const routeCoords = routePolyline
    ? decodePolyline(routePolyline).map((p) => ({ latitude: p.lat, longitude: p.lng }))
    : [];

  // Re-centre the map whenever the user moves
  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude:       userLocation.lat,
        longitude:      userLocation.lng,
        latitudeDelta:  0.005,
        longitudeDelta: 0.005,
      },
      500,
    );
  }, [userLocation?.lat, userLocation?.lng]);

  if (!userLocation) {
    return (
      <View style={[styles.container, styles.placeholder]}>
        <Text style={styles.placeholderText}>Acquiring GPS…</Text>
      </View>
    );
  }

  return (
    <RNMapView
      ref={mapRef}
      style={styles.container}
      provider={PROVIDER_GOOGLE}
      showsUserLocation
      showsMyLocationButton={false}
      followsUserLocation={false}
      initialRegion={{
        latitude:       userLocation.lat,
        longitude:      userLocation.lng,
        latitudeDelta:  0.008,
        longitudeDelta: 0.008,
      }}
    >
      {/* ── Route polyline ─────────────────────────────────────────── */}
      {routeCoords.length > 1 && (
        <Polyline
          coordinates={routeCoords}
          strokeColor={routeColor(safetyStatus)}
          strokeWidth={4}
          lineDashPattern={undefined}
        />
      )}

      {/* ── Destination pin ────────────────────────────────────────── */}
      {destination && (
        <Marker
          coordinate={{ latitude: destination.lat, longitude: destination.lng }}
          title="Destination"
          pinColor="#6366F1"
        />
      )}

      {/* ── User location dot (custom, shown on top of showsUserLocation) */}
      <Marker
        coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
        anchor={{ x: 0.5, y: 0.5 }}
        flat
      >
        <View style={[styles.userDot, { borderColor: routeColor(safetyStatus) }]} />
      </Marker>
    </RNMapView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  placeholder: {
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textLight,
  },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
