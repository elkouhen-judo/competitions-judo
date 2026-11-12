const { getAssetVersions, readClientBundle, sendVersionedAsset } = require("./_assets");

// SHELL-2 : Vue et les écrans compilés sont servis en un fichier minifié, produit par le build.
module.exports = function handler(req, res) {
  sendVersionedAsset(
    req,
    res,
    "application/javascript; charset=utf-8",
    getAssetVersions().client,
    readClientBundle()
  );
};
