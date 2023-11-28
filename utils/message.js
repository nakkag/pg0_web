"use strict";

let resource = {
	EXEC_SPEED: {'0': 'No Wait', '1': 'Fast', '250': 'Normal', '500': 'Slow'},

	SETTING_MODE_TITLE: 'Exec mode',
	SETTING_MODE: {'PG0': 'PG0', 'PG0_5': 'PG0.5'},
	SETTING_FONT_SIZE_TITLE: 'Font size',
	SETTING_FONT_SIZE: {'14': 'Small', '18': 'Medium', '24': 'Large'},
	SETTING_LINENUM_TITLE: 'Show Line number',

	CTRL_EXEC: 'Exec',
	CTRL_STEP_EXEC: 'Step exec',
	CTRL_STOP: 'Stop',
	CTRL_EXEC_SPEED: 'Exec speed',

	CONSOLE_START: 'Start',
	CONSOLE_END: 'End',
	CONSOLE_STOP: 'Stop',
	CONSOLE_RESULT: 'Result:',

	MENU_NEW: 'New',
	MENU_OPEN: 'Open local file',
	MENU_SAVE: 'Save to local file',
	MENU_RUN_TO_CURSOR: 'Run to Cursor',
	MENU_CLEAR: 'Claer console',
	MENU_SETTING: 'Setting',
	MENU_TUTORIAL: 'Tutorial',

	VARIABLE_NAME: 'Name',
	VARIABLE_VALUE: 'Value',

	MSG_NEW: 'Are you sure you want your changes to be discarded?',
	MSG_SAVE: 'Name of file to be saved',
};

if (_lang === 'ja') {
	resource = {
		EXEC_SPEED: {'0': '待ち無し', '1': '速い', '250': '普通', '500': '遅い'},

		SETTING_MODE_TITLE: '実行モード',
		SETTING_MODE: {'PG0': 'PG0', 'PG0_5': 'PG0.5'},
		SETTING_FONT_SIZE_TITLE: '文字の大きさ',
		SETTING_FONT_SIZE: {'14': '小さい', '18': '普通', '24': '大きい'},
		SETTING_LINENUM_TITLE: '行番号を表示',

		CTRL_EXEC: '実行',
		CTRL_STEP_EXEC: 'ステップ実行',
		CTRL_STOP: '停止',
		CTRL_EXEC_SPEED: '実行速度',

		CONSOLE_START: '開始',
		CONSOLE_END: '終了',
		CONSOLE_STOP: '停止',
		CONSOLE_RESULT: '実行結果:',

		MENU_NEW: '新規',
		MENU_OPEN: 'ローカルファイルを開く',
		MENU_SAVE: 'ローカルファイルに保存',
		MENU_RUN_TO_CURSOR: 'カーソル行まで実行',
		MENU_CLEAR: '実行結果のクリア',
		MENU_SETTING: '設定',
		MENU_TUTORIAL: 'チュートリアル',

		VARIABLE_NAME: '変数',
		VARIABLE_VALUE: '値',

		MSG_NEW: '変更を破棄してもよろしいですか？',
		MSG_SAVE: '保存するファイル名',
	};
}
