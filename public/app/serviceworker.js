// The service worker of the app page (/app/): the page and what it loads are
// kept in a cache, so that a program opened before runs with no network, and
// an app added to a home screen opens offline. The programs themselves are
// kept by the page (app.js), under their own cache, since they change on
// their own time; this worker leaves /api/ to the network.
//
// A new version of the page or of a file it loads goes with a new
// CACHE_VERSION: the files are served from the cache first, as in /dev/.
const CACHE_VERSION = 'pg0-app-v1';

const resources = [
	'./',
	'app.css',
	'app.js',
	'pack.js',
	'/favicon.ico',

	'/dev/pg0/script_common.js',
	'/dev/pg0/script_exec.js',
	'/dev/pg0_settings.js',

	'/dev/view/console.css',
	'/dev/view/console.js',

	'/dev/utils/date_format.js',
	'/dev/utils/message.js',
	'/dev/utils/pg0_string.js',
	'/dev/utils/reset.css',

	'/dev/image/icon.png',
	'/dev/image/icon_256.png',

	'/dev/lib/math.js',
	'/dev/lib/screen.js',
	'/dev/lib/io.js',
	'/dev/lib/string.js',
	'/dev/lib/net.js',
	'/dev/lib/image/sc_close.svg',
	'/dev/lib/image/sc_icon.svg',
	'/dev/lib/image/sc_restore.svg',
	'/dev/lib/image/sc_mute.svg',
	'/dev/lib/image/sc_speaker.svg',
];

self.addEventListener('install', function (event) {
	event.waitUntil(
		self.caches.open(CACHE_VERSION).then(function (cache) {
			// (a file that cannot be had is left out, and comes from the network)
			return Promise.all(resources.map(function(r) {
				return cache.add(new Request(r, {cache: 'no-cache'})).catch(function(error) {
					console.error('cache error:', r, error);
				});
			}));
		}).then(function() {
			self.skipWaiting();
		})
	);
});

self.addEventListener('fetch', function (event) {
	const url = new URL(event.request.url);
	if (url.origin !== location.origin || event.request.method !== 'GET' || url.pathname.indexOf('/api/') === 0) {
		return;
	}
	if (event.request.mode === 'navigate') {
		// The page comes from the server, which puts the program's name in it;
		// with no network, the page as it was cached (its script names the program).
		event.respondWith(
			fetch(event.request).catch(function() {
				return self.caches.open(CACHE_VERSION).then(function (cache) {
					return cache.match('./');
				});
			})
		);
		return;
	}
	event.respondWith(
		self.caches.open(CACHE_VERSION).then(function (cache) {
			return cache.match(event.request, {ignoreSearch: true});
		}).then(function (response) {
			return response || fetch(event.request);
		})
	);
});

self.addEventListener('activate', function (event) {
	event.waitUntil(
		self.caches.keys().then(function (keyList) {
			// (the caches of the editor, /dev/, and of the programs are not this worker's)
			return Promise.all(keyList.map(function (key) {
				if (/^pg0-app-v/.test(key) && key !== CACHE_VERSION) {
					return self.caches.delete(key);
				}
			}));
		}).then(function() {
			self.clients.claim();
		})
	);
});
