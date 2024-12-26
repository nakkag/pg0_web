"use strict";

let resource = {
	EXEC_SPEED: {'0': 'No wait', '1': 'Fast', '250': 'Normal', '500': 'Slow'},

	SETTING_MODE_TITLE: 'Execution mode',
	SETTING_MODE: {'PG0': 'PG0', 'PG0_5': 'PG0.5'},
	SETTING_FONT_SIZE_TITLE: 'Font size',
	SETTING_FONT_SIZE: {'14': 'Small', '18': 'Medium', '24': 'Large'},
	SETTING_LINENUM_TITLE: 'Show line number',

	ONLINE_OPEN_COPY: 'Copy URL',
	ONLINE_OPEN_COPY_AUTORUN: 'Copy autorun URL',
	ONLINE_OPEN_HISTORY: 'Revision history',
	ONLINE_OPEN_REMOVE: 'Remove',
	ONLINE_OPEN_REMOVE_PASSWORD: 'Enter the edit password.',
	ONLINE_OPEN_READ_TITLE: 'Read more...',
	ONLINE_HISTORY_CURRENT: 'Current version',

	ONLINE_SAVE_FILE_TITLE: 'File name',
	ONLINE_SAVE_AUTHOR_TITLE: 'Author',
	ONLINE_SAVE_PASSWORD_TITLE: 'Edit password',
	ONLINE_SAVE_NEW_TITLE: 'Save as new file',
	ONLINE_SAVE_PRIVATE_TITLE: 'Private',
	ONLINE_SAVE_BUTTON: 'Save',

	ONLINE_CONFIRM_PRIVATE: 'If set to private, it will not appear in the online list.\nSave the URL, as only those who know the URL can open it.',
	ONLINE_ERROR_UNAUTHORIZED: 'Incorrect password.',
	ONLINE_ERROR_NOT_FOUND: 'File not found.',
	ONLINE_ERROR_CONNECTION: 'Connection failed.',
	ONLINE_ERROR_CONFLICT: 'File name already exists.\nPlease change it to another name.',

	CTRL_EXEC: 'Execution (F5)',
	CTRL_STEP_EXEC: 'Step execution (F10)',
	CTRL_STOP: 'Stop (Shift+F5)',
	CTRL_EXEC_SPEED: 'Execution speed',

	CONSOLE_START: 'Start',
	CONSOLE_END: 'End',
	CONSOLE_STOP: 'Stop',
	CONSOLE_RESULT: 'Result:',

	MENU_NEW: 'New',
	MENU_ONLINE_OPEN: 'Open online',
	MENU_ONLINE_SAVE: 'Save to online',
	MENU_ONLINE_HISTORY: 'Revision history',
	MENU_LOCAL_OPEN: 'Open local file',
	MENU_LOCAL_SAVE: 'Save to local file',
	MENU_EXEC_TO_CURSOR: 'Execute to cursor (Ctrl+F10)',
	MENU_CLEAR: 'Claer console',
	MENU_SETTING: 'Setting',
	MENU_TUTORIAL: 'Tutorial',
	MENU_MANUAL_PG0: 'PG0 Language specification',
	MENU_MANUAL_PG05: 'PG0.5 Language specification',
	MENU_MANUAL_LIB: 'Library Reference',

	VARIABLE_NAME: 'Name',
	VARIABLE_VALUE: 'Value',

	MSG_NEW: 'Are you sure you want your changes to be discarded?',
	MSG_SAVE: 'Name of file to be saved',
	MSG_TUTORIAL: 'Do you want to open the tutorial?<br /><br />(The tutorial can be opened at any time from the menu.)',

	DIALOG_YES: 'Yes',
	DIALOG_NO: 'No',

	TUTORIAL_URL: 'https://nakka.com/soft/pg0/tutorial/index_eng.html',
	MANUAL_PG0_URL: 'https://nakka.com/soft/pg0/pg0_eng.txt.html',
	MANUAL_PG05_URL: 'https://nakka.com/soft/pg0/pg0.5_eng.txt.html',
	MANUAL_LIB_URL: 'https://nakka.com/soft/pg0/pg0.5_lib_eng.html',
};

if (_lang === 'ja') {
	resource = {
		EXEC_SPEED: {'0': '待ち無し', '1': '速い', '250': '普通', '500': '遅い'},

		SETTING_MODE_TITLE: '実行モード',
		SETTING_MODE: {'PG0': 'PG0', 'PG0_5': 'PG0.5'},
		SETTING_FONT_SIZE_TITLE: '文字の大きさ',
		SETTING_FONT_SIZE: {'14': '小さい', '18': '普通', '24': '大きい'},
		SETTING_LINENUM_TITLE: '行番号を表示',

		ONLINE_OPEN_COPY: 'URLをコピー',
		ONLINE_OPEN_COPY_AUTORUN: '自動実行URLをコピー',
		ONLINE_OPEN_HISTORY: '変更履歴',
		ONLINE_OPEN_REMOVE: '削除',
		ONLINE_OPEN_REMOVE_PASSWORD: '編集パスワードを入力してください。',
		ONLINE_OPEN_READ_TITLE: 'さらに読み込む...',
		ONLINE_HISTORY_CURRENT: '現在のバージョン',

		ONLINE_SAVE_FILE_TITLE: 'ファイル名',
		ONLINE_SAVE_AUTHOR_TITLE: '作成者',
		ONLINE_SAVE_PASSWORD_TITLE: '編集パスワード',
		ONLINE_SAVE_NEW_TITLE: '新しいファイルとして保存する',
		ONLINE_SAVE_PRIVATE_TITLE: '非公開',
		ONLINE_SAVE_BUTTON: '保存',

		ONLINE_CONFIRM_PRIVATE: '非公開に設定するとオンライン一覧に表示されなくなります。\nURLを知っている人だけが開けるため、URLを保存しておいてください。',
		ONLINE_ERROR_UNAUTHORIZED: 'パスワードが間違っています。',
		ONLINE_ERROR_NOT_FOUND: 'ファイルが見つかりません。',
		ONLINE_ERROR_CONNECTION: '接続に失敗しました。',
		ONLINE_ERROR_CONFLICT: '既に存在するファイル名です。\n別の名前で保存してください。',

		CTRL_EXEC: '実行 (F5)',
		CTRL_STEP_EXEC: 'ステップ実行 (F10)',
		CTRL_STOP: '停止 (Shift+F5)',
		CTRL_EXEC_SPEED: '実行速度',

		CONSOLE_START: '開始',
		CONSOLE_END: '終了',
		CONSOLE_STOP: '停止',
		CONSOLE_RESULT: '実行結果:',

		MENU_NEW: '新規',
		MENU_ONLINE_OPEN: 'オンラインを開く',
		MENU_ONLINE_SAVE: 'オンラインに保存',
		MENU_ONLINE_HISTORY: '変更履歴',
		MENU_LOCAL_OPEN: 'ローカルファイルを開く',
		MENU_LOCAL_SAVE: 'ローカルファイルに保存',
		MENU_EXEC_TO_CURSOR: 'カーソル行まで実行 (Ctrl+F10)',
		MENU_CLEAR: '実行結果のクリア',
		MENU_SETTING: '設定',
		MENU_TUTORIAL: 'チュートリアル',
		MENU_MANUAL_PG0: 'PG0言語仕様',
		MENU_MANUAL_PG05: 'PG0.5言語仕様',
		MENU_MANUAL_LIB: 'ライブラリリファレンス',

		VARIABLE_NAME: '変数',
		VARIABLE_VALUE: '値',

		MSG_NEW: '変更を破棄してもよろしいですか？',
		MSG_SAVE: '保存するファイル名',
		MSG_TUTORIAL: 'チュートリアルを開きますか？<br /><br />(チュートリアルはメニューからいつでも開けます)',

		DIALOG_YES: 'はい',
		DIALOG_NO: 'いいえ',

		TUTORIAL_URL: 'https://nakka.com/soft/pg0/tutorial/',
		MANUAL_PG0_URL: 'https://nakka.com/soft/pg0/pg0.txt.html',
		MANUAL_PG05_URL: 'https://nakka.com/soft/pg0/pg0.5.txt.html',
		MANUAL_LIB_URL: 'https://nakka.com/soft/pg0/pg0.5_lib.html',
	};
}
