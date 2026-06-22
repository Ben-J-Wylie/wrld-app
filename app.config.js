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
        // Pin the native Mapbox Maps SDK newer than rnmapbox 10.3.1's default
        // (11.20.1). 11.22.1 shipped gesture-interaction fixes and 11.x added a
        // "skip pan while a shove/tilt gesture is in progress" guard — the pan-vs-
        // tilt interaction behind the Android globe snap-back. Requires an EAS
        // rebuild (native change). Applies to iOS + Android; iOS already works at
        // 11.20.1, this is a minor same-major bump.
        RNMapboxMapsVersion: '11.23.1',
      },
    ],
  ],
})
