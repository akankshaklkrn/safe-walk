const appJson = require('./app.json');

const expo = appJson.expo;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

module.exports = {
  ...expo,
  ios: {
    ...expo.ios,
    config: googleMapsApiKey
      ? {
          ...(expo.ios?.config ?? {}),
          googleMapsApiKey,
        }
      : expo.ios?.config,
  },
  android: {
    ...expo.android,
    config: {
      ...(expo.android?.config ?? {}),
      googleMaps: {
        ...(expo.android?.config?.googleMaps ?? {}),
        ...(googleMapsApiKey ? { apiKey: googleMapsApiKey } : {}),
      },
    },
  },
};
