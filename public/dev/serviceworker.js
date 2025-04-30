const CACHE_VERSION = 'pg0-v369';

const resources = [
	'./',
	'pg0.css',
	'pg0.js',
	'pg0_settings.js',
	'favicon.ico',

	'pg0/script_common.js',
	'pg0/script_exec.js',
	'pg0/script_parse.js',

	'view/editor.css',
	'view/editor.js',
	'view/variable.css',
	'view/variable.js',
	'view/console.css',
	'view/console.js',
	'view/dialog.css',
	'view/dialog.js',

	'utils/user_agent.js',
	'utils/date_format.js',
	'utils/message.js',
	'utils/pg0_string.js',
	'utils/reset.css',

	'image/close.svg',
	'image/icon.png',
	'image/icon_256.png',
	'image/icon.svg',
	'image/kebob_menu.svg',
	'image/left.svg',
	'image/load.svg',
	'image/paste.svg',
	'image/play.svg',
	'image/redo.svg',
	'image/right.svg',
	'image/search.svg',
	'image/step.svg',
	'image/stop.svg',
	'image/tab.svg',
	'image/undo.svg',

	'lib/math.js',
	'lib/math.pg0',
	'lib/screen.js',
	'lib/screen.pg0',
	'lib/io.js',
	'lib/io.pg0',
	'lib/string.js',
	'lib/string.pg0',
	'lib/image/sc_close.svg',
	'lib/image/sc_icon.svg',
	'lib/image/sc_restore.svg',
	'lib/image/sc_mute.svg',
	'lib/image/sc_speaker.svg',
];

self.addEventListener('install', function (event) {
	event.waitUntil(
		self.caches.open(CACHE_VERSION).then(function (cache) {
			resources.forEach(function(r) {
				cache.add(new Request(r, {cache: 'no-cache'}));
			});
		}).then(function() {
			self.skipWaiting();
		})
	);
});

self.addEventListener('fetch', function (event) {
	if (new URL(event.request.url).origin !== location.origin) {
		return;
	}
	event.respondWith(
		self.caches.match(event.request, {ignoreSearch: true}).then(function (response) {
			if (response) {
				return response;
			} else {
				return fetch(event.request, {cache: 'no-cache'});
			}
		})
	);
});

self.addEventListener('activate', function (event) {
	event.waitUntil(
		self.caches.keys().then(function (keyList) {
			return Promise.all(keyList.map(function (key) {
				if (key !== CACHE_VERSION) {
					return self.caches.delete(key);
				}
			}));
		}).then(function() {
			self.clients.claim();
		})
	);
});
