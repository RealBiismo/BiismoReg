const fs = require('node:fs');
const path = require('node:path');

// Render applies NODE_OPTIONS to the build command as well as the running app.
// During a clean `npm install`, application dependencies do not exist yet, so
// only load the BIISMO feature hooks once Express has actually been installed.
const expressPackage = path.join(process.cwd(), 'node_modules', 'express', 'package.json');

if (fs.existsSync(expressPackage)) {
  require('./account-inject.cjs');
  require('./feature-preload.cjs');
}
