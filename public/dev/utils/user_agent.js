"use strict";

const user_agent = (function () {
	const me = {};

	const ua = {};
	me.get = function () {
		if (ua.length > 0) {
			return ua;
		}
		ua.name = window.navigator.userAgent.toLowerCase();
		ua.isiPhone = ua.name.indexOf('iphone') >= 0;
		ua.isiPod = ua.name.indexOf('ipod') >= 0;
		ua.isiPad = ua.name.indexOf('ipad') >= 0 || ua.name.indexOf('macintosh') > -1 && 'ontouchend' in document;
		ua.isiOS = (ua.isiPhone || ua.isiPod || ua.isiPad);
		ua.isAndroid = ua.name.indexOf('android') >= 0;
		ua.isChromeOS = ua.name.indexOf('cros') >= 0;
		ua.isTablet = (ua.isiPad || (ua.isAndroid && ua.name.indexOf('mobile') < 0));
		return ua;
	};

	return me;
})();
