// =========================================================================
// SERVICE WORKER — TUCANO CLOUD PWA
// Cache offline seguro do App Shell (index.html, módulos JS, styles, ícones)
// =========================================================================

const CACHE_NAME = 'tucano-cloud-v1.0.0';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './app-icon.svg',
    './styles.css',
    './js/nucleo-financeiro.js',
    './js/clientes.js',
    './js/relatorios.js',
    './js/configuracoes.js',
    './js/impressao.js',
    './js/whatsapp.js',
    './js/backup-v3.js',
    './js/seguranca.js'
];

// Instalação: Pré-cache dos ativos estáticos essenciais
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[SW] Falha ao pré-carregar alguns ativos no cache:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network-First com Fallback para Cache para o App Shell
// NUNCA intercepta requisições de API, Firebase RTDB ou CDN externa de autenticação
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Bypass total para requisições de banco de dados, auth e WebSockets
    if (
        req.method !== 'GET' ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('identitytoolkit') ||
        url.protocol === 'chrome-extension:'
    ) {
        return;
    }

    event.respondWith(
        fetch(req)
            .then((networkRes) => {
                if (networkRes && networkRes.status === 200 && req.url.startsWith(self.location.origin)) {
                    const resClone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                }
                return networkRes;
            })
            .catch(() => {
                return caches.match(req).then((cached) => {
                    if (cached) return cached;
                    if (req.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return null;
                });
            })
    );
});
