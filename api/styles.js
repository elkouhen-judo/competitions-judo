const { getAssetVersions, readStylesBundle, sendVersionedAsset } = require("./_assets");

module.exports = function handler(req, res) {
  sendVersionedAsset(
    req,
    res,
    "text/css; charset=utf-8",
    getAssetVersions().styles,
    readStylesBundle()
  );
};
