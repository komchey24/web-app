/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

/*
 * API proxy configuration targeting the kc24 Fineract backend.
 * Usage: ng serve --proxy-config proxy.kc24.conf.js
 */
const TARGET = 'https://kc24.b-cdn.net';

const proxyConfig = [
  {
    context: ['/fineract-provider'],
    target: TARGET,
    changeOrigin: true,
    secure: true,
    logLevel: 'debug',
    on: {
      proxyReq: function (proxyReq, req, res) {
        console.log('[Proxy] Proxying:', req.method, req.url, '->', TARGET + req.url);
      },
      error: function (err, req, res) {
        console.error(
          '[Proxy] Error while proxying request:',
          req && req.method,
          req && req.url,
          '-> ' + TARGET + ' -',
          err && err.message
        );
        if (res && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end('Proxy error: ' + (err && err.message ? err.message : 'Unknown error'));
        }
      }
    }
  }
];

module.exports = proxyConfig;