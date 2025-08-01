
/**
 * @OnlyCurrentDoc
 */

// ===============================================================
// 設定項目: ご自身の環境に合わせて以下の2つの値を変更してください
// ===============================================================

// 1. データを記録するGoogleスプレッドシートのID
// 例: https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXX/edit の場合
// 「XXXXXXXXXXXXXXXXXXXX」の部分がIDです。
const SHEET_ID = "1gmCngK56SOzTOv79t3VOrV6OPemSyudCzhmOQZSH3xg";

// 2. アップロードされた画像を保存するGoogleドライブのフォルダID
// 例: https://drive.google.com/drive/folders/YYYYYYYYYYYYYYYYYYYY の場合
// 「YYYYYYYYYYYYYYYYYYYY」の部分がIDです。
const FOLDER_ID = "1TXSUGZvVtRYiT_aNmBoHCyjC2qqguR1w";

// ===============================================================
// メイン処理: 通常、この下のコードを編集する必要はありません
// ===============================================================

/**
 * WebアプリにPOSTリクエストが送られたときに実行されるメイン関数
 * @param {Object} e - イベントオブジェクト (リクエストデータを含む)
 * @returns {ContentService.TextOutput} - フロントエンドに返すJSONレスポンス
 */
function doPost(e) {
  try {
    // POSTされたJSONデータをパース
    const requestData = JSON.parse(e.postData.contents);

    // Base64エンコードされた画像データを取得
    const base64Data = requestData.screenshot; // HTML側のフィールド名と一致させる
    const fileName = new Date().toISOString().replace(/:/g, '-') + ".png";
    
    // 画像をGoogleドライブに保存し、そのURLを取得
    const imageUrl = saveImageToDrive(base64Data, fileName);

    // スプレッドシートに書き込むデータを準備
    const sheetData = {
      timestamp: new Date(),
      cd_number: requestData.cd_number,
      label_status: requestData.label_status,
      save_condition: requestData.save_condition,
      binder_title: requestData.binder_title,
      barcode: requestData.barcode,
      media_title: requestData.media_title,
      property_text: requestData.property_text,
      image_url: imageUrl, // 画像URLを追加
    };

    // スプレッドシートにデータを書き込む
    writeToSheet(sheetData);

    // 成功レスポンスを返す
    return createJsonResponse({ status: "success", message: "データが正常に記録されました。", url: imageUrl });

  } catch (error) {
    // エラーレスポンスを返す
    Logger.log("エラーが発生しました: " + error.message);
    Logger.log("スタックトレース: " + error.stack);
    return createJsonResponse({ status: "error", message: "サーバー側でエラーが発生しました: " + error.message });
  }
}

/**
 * WebアプリにGETリクエストが送られたときに実行される関数
 * @param {Object} e - イベントオブジェクト (リクエストパラメータを含む)
 * @returns {ContentService.TextOutput} - フロントエンドに返すJSONレスポンス
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    let responseData;

    if (action === 'getNextCdNumber') {
      responseData = { nextCdNumber: getNextCdNumber() };
    } else if (action === 'getHistory') {
      const limit = e.parameter.limit || 5; // デフォルトは5件
      responseData = { history: getHistoryData(limit) };
    } else {
      throw new Error('無効なアクションが指定されました。');
    }

    return createJsonResponse({ status: 'success', data: responseData });

  } catch (error) {
    Logger.log("GETリクエスト処理中にエラーが発生しました: " + error.message);
    return createJsonResponse({ status: 'error', message: 'データ取得中にエラーが発生しました: ' + error.message });
  }
}

/**
 * Base64データをデコードしてGoogleドライブに画像として保存する
 * @param {string} base64Data - Base64エンコードされた画像データ
 * @param {string} fileName - 保存するファイル名
 * @returns {string} - 保存された画像のURL
 */
function saveImageToDrive(base64Data, fileName) {
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return "画像データがありません";
  }

  const contentType = base64Data.split(';')[0].split(':')[1];
  const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, fileName);
  
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const file = folder.createFile(blob);
  
  return file.getUrl();
}

/**
 * 指定されたデータをスプレッドシートに書き込む
 * @param {Object} data - 書き込むデータオブジェクト
 */
function writeToSheet(data) {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getActiveSheet(); // または特定のシート名で取得 `getSheetByName("シート名")`

  // ヘッダー行を定義（スプレッドシートの1行目に手動で設定するのと一致させる）
  const headers = [
    "タイムスタンプ", "CD連番", "ラベルの有無", "保存状態", 
    "バインダータイトル", "バーコード", "メディアタイトル", 
    "プロパティ", "画像URL"
  ];
  
  // ヘッダー行が存在しない場合は作成
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  // dataオブジェクトをヘッダーの順序に合わせて配列に変換
  const newRow = headers.map(header => {
    // マッピング: GASのキーをヘッダー名に合わせる（必要に応じて調整）
    const keyMap = {
      "タイムスタンプ": "timestamp",
      "CD連番": "cd_number",
      "ラベルの有無": "label_status",
      "保存状態": "save_condition",
      "バインダータイトル": "binder_title",
      "バーコード": "barcode",
      "メディアタイトル": "media_title",
      "プロパティ": "property_text",
      "画像URL": "image_url"
    };
    return data[keyMap[header]] || ""; // 対応するデータがなければ空文字
  });

  sheet.appendRow(newRow);
}

/**
 * JSON形式のレスポンスを生成する
 * @param {Object} obj - レスポンスとして返すオブジェクト
 * @returns {ContentService.TextOutput} - JSONP形式のテキスト出力
 */
function createJsonResponse(obj) {
  const jsonp = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  // CORSヘッダーを追加して、どのオリジンからでもアクセスを許可する
  jsonp.setHeader('Access-Control-Allow-Origin', '*');
  return jsonp;
}

/**
 * スプレッドシートから次のCD連番を取得する
 * @returns {number} - 次のCD連番
 */
function getNextCdNumber() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1; // データがヘッダー行のみの場合は1から開始
  }
  // CD連番は2列目（B列）と仮定
  const lastCdNumber = sheet.getRange(lastRow, 2).getValue();
  return !isNaN(lastCdNumber) ? parseInt(lastCdNumber, 10) + 1 : 1;
}

/**
 * スプレッドシートから登録履歴を取得する
 * @param {number} limit - 取得する件数
 * @returns {Array<Object>} - 履歴データの配列
 */
function getHistoryData(limit) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (lastRow < 2) {
    return []; // データなし
  }

  const startRow = Math.max(2, lastRow - limit + 1);
  const numRows = lastRow - startRow + 1;
  const data = sheet.getRange(startRow, 1, numRows, headers.length).getValues();

  // データをJSONオブジェクトの配列に変換
  const history = data.map(row => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = row[index];
    });
    return entry;
  }).reverse(); // 新しいものが上に来るように逆順にする

  return history;
}

