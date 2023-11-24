"use strict";

const date_format = (function () {
	const me = {};

	me.dateFormat = {
		"YYYY/MM/DD" : [
			"ja", "si", "zh-cn", "zh-hk", "zh-tw",
		],
		"YYYY.MM.DD" : [
			"hu", "ko",
		],
		"YYYY-MM-DD" : [
			"en-ca", "eo", "eu", "fr-ca", "lt", "sv",
		],
		"DD.MM.YYYY" : [
			"az", "be", "bg", "bs", "cs", "de-at", "de-ch", "de", "et", "fi", "fr-ch", "hr",
			"hy-am", "is", "kk", "ky", "lb", "lo", "lv", "me", "mk", "nb", "nn", "pl", "ro",
			"ru", "se", "sk", "sl", "sr-cyrl", "sr", "sw", "tlh", "tr", "tzl", "uk",
		],
		"DD/MM/YYYY" : [
			"af", "ar-dz", "ar-kw", "ar-ly", "ar-ma", "ar-sa", "ar-tn", "ar", "bn", "bo", "br",
			"ca", "cy", "da", "dv", "el", "en-au", "en-gb", "en-nz", "es-do", "es", "fa", "fo",
			"fr", "gd", "gl", "he", "hi", "id", "it", "jv", "ka", "km", "kn", "mi", "ml", "mr",
			"ms-my", "ms", "my", "ne", "nl-be", "pa-in", "pt-br", "pt", "sd", "sq", "ss", "ta",
			"te", "tet", "th", "tzm-latn", "tzm", "ur", "uz-latn", "uz", "vi", "x-pseudo", "yo",
		],
		"DD-MM-YYYY" : [
			"cv", "en-ie", "fy", "gom-latn", "nl",
		],
	};
	
	me.timeSecFormat = {
		"hh.mm.ss" : [
			"de-ch", "fi", "id", "jv", "ms-my", "ms", "tzl", 
		],
	};

	me.timeFormat = {
		"hh.mm" : [
			"de-ch", "fi", "id", "jv", "ms-my", "ms", "tzl", 
		],
	};

	me._format = function (date, format) {
		format = format.replace(/YYYY/g, date.getFullYear());
		format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
		format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
		format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
		format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
		format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
		return format;
	};

	me.formatDate = function (date, lang) {
		const format = 'MM/DD/YYYY';
		if (!lang) {
			return me._format(date, format);
		}
		lang = lang.toLowerCase();
		for (let fmt in me.dateFormat) {
			for (let i = 0; i < me.dateFormat[fmt].length; i++) {
				if (lang.indexOf(me.dateFormat[fmt][i]) === 0) {
					return me._format(date, fmt);
				}
			}
		}
		return me._format(date, format);
	}

	me.formatTimeSec = function (date, lang) {
		const format = 'hh:mm:ss';
		if (!lang) {
			return me._format(date, format);
		}
		lang = lang.toLowerCase();
		for (let fmt in me.timeSecFormat) {
			for (let i = 0; i < me.timeSecFormat[fmt].length; i++) {
				if (lang.indexOf(me.timeSecFormat[fmt][i]) === 0) {
					return me._format(date, fmt);
				}
			}
		}
		return me._format(date, format);
	}

	me.formatTime = function (date, lang) {
		const format = 'hh:mm';
		if (!lang) {
			return me._format(date, format);
		}
		lang = lang.toLowerCase();
		for (let fmt in me.timeFormat) {
			for (let i = 0; i < me.timeFormat[fmt].length; i++) {
				if (lang.indexOf(me.timeFormat[fmt][i]) === 0) {
					return me._format(date, fmt);
				}
			}
		}
		return me._format(date, format);
	}
	return me;
})();
