const express = require('express');

const LEGACY_HOST = 'biismoreg-com.onrender.com';
const CANONICAL_ORIGIN = 'https://biismoreg.com';
const originalStatic = express.static;

express.static = function biismoCanonicalStatic(root, options) {
  const staticMiddleware = originalStatic(root, options);

  return function canonicalHostMiddleware(req, res, next) {
    const hostname = String(req.hostname || req.get?.('host') || '').split(':')[0].toLowerCase();
    const isPageRequest = req.method === 'GET' || req.method === 'HEAD';
    const machineRoute = req.path.startsWith('/api/') || req.path.startsWith('/auth/');

    if (hostname === LEGACY_HOST && isPageRequest && !machineRoute) {
      const destination = new URL(req.originalUrl || req.url || '/', CANONICAL_ORIGIN);
      return res.redirect(302, destination.href);
    }

    return staticMiddleware(req, res, next);
  };
};
