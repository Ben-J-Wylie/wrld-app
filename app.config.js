// Dynamic config — extends app.json and injects secrets that must not be
// committed to the repo (Mapbox download token, etc.).
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsImpl: 'mapbox',
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN ?? '',
      },
    ],
  ],
})
