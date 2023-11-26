"use strict";

let runMsg = {
	CONSOLE_START: 'Start',
	CONSOLE_END: 'End',
	CONSOLE_STOP: 'Stop',
	CONSOLE_RESULT: 'Result:',

	MENU_NEW: 'New',
	MENU_OPEN: 'Open',
	MENU_SAVE: 'Save',
	MENU_RUN_TO_CURSOR: 'Run to Cursor',
	MENU_CLEAR: 'Claer console',
	MENU_SETTING: 'Setting',
	MENU_TUTORIAL: 'Tutorial',

	VARIABLE_NAME: 'Name',
	VARIABLE_VALUE: 'Value',

	MSG_NEW: 'Are you sure you want your changes to be discarded?',
};

if (_lang === 'ja') {
	runMsg = {
		CONSOLE_START: '開始',
		CONSOLE_END: '終了',
		CONSOLE_STOP: '停止',
		CONSOLE_RESULT: '実行結果:',

		MENU_NEW: '新規',
		MENU_OPEN: '開く',
		MENU_SAVE: '保存',
		MENU_RUN_TO_CURSOR: 'カーソル行まで実行',
		MENU_CLEAR: '実行結果のクリア',
		MENU_SETTING: '設定',
		MENU_TUTORIAL: 'チュートリアル',

		VARIABLE_NAME: '変数',
		VARIABLE_VALUE: '値',

		MSG_NEW: '変更を破棄してもよろしいですか？',
	};
}
