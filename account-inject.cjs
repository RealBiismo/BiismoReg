const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const originalStatic = express.static;

express.static = function biismoStatic(root, options) {
  const middleware = originalStatic(root, options);
  const absoluteRoot = path.resolve(root);
  return function injectedStatic(req, res, next) {
    if (req.method === 'GET' && (req.path === '/account.html' || req.path === '/account')) {
      const file = path.join(absoluteRoot, 'account.html');
      fs.readFile(file, 'utf8', (error, html) => {
        if (error) return next();
        const withStyles = html.includes('features.css') ? html : html.replace('</head>', '  <link rel="stylesheet" href="/features.css">\n</head>');
        const withScript = withStyles.includes('garage-features.js') ? withStyles : withStyles.replace('</body>', '  <script src="/garage-features.js" defer></script>\n</body>');
        res.type('html').send(withScript);
      });
      return;
    }
    return middleware(req, res, next);
  };
};
