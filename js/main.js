// --- グローバル変数と設定 ---
const form = document.getElementById('cdMediaForm');
const formElements = form.elements;
const submitButton = document.getElementById('submit-button');
const clearButton = document.getElementById('clear-button');
const formStatus = document.getElementById('form-status');
const cdNumberInput = document.getElementById('cd_number');

const iframe = document.getElementById('hidden_iframe');

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    loadFormData();
    setupAutoSave();
    iframe.addEventListener('load', onFormSubmit);
});

// --- フォーム処理 ---
let formSubmitted = false;

form.addEventListener('submit', (e) => {
    // Googleフォームへの送信はiframeで行うため、デフォルトの送信を止める必要はない
    submitButton.disabled = true;
    showStatus('送信中... しばらくお待ちください。', 'info');
    formSubmitted = true; // 送信開始のフラグを立てる
});

function onFormSubmit() {
    // iframeのonloadイベントはページの初期読み込み時にも発生するため、
    // フォームが実際に送信された後（formSubmitted = true）にのみ処理を実行する
    if (formSubmitted) {
        form.reset();
        localStorage.removeItem('cdMediaFormData');
        showStatus('送信が完了しました！新しいデータを入力できます。', 'success');
        cdNumberInput.focus(); // CD連番フィールドにフォーカス
        submitButton.disabled = false;
        formSubmitted = false; // フラグをリセット
    }
}

clearButton.addEventListener('click', () => {
    if (confirm('入力内容をすべてクリアしますか？')) {
        clearFormData();
    }
});

// --- ローカルストレージ (一時保存) ---
function setupAutoSave() {
    form.addEventListener('input', saveFormData);
}

function saveFormData() {
    const data = {};
    for (const element of formElements) {
        if (element.name && element.type !== 'file') { // file inputは保存しない
            if (element.type === 'radio') {
                if (element.checked) data[element.name] = element.value;
            } else {
                data[element.name] = element.value;
            }
        }
    }
    localStorage.setItem('cdMediaFormData', JSON.stringify(data));
}

function loadFormData() {
    const data = JSON.parse(localStorage.getItem('cdMediaFormData'));
    if (data) {
        for (const key in data) {
            const element = formElements[key];
            if (element) {
                if (element.type === 'radio') {
                    document.querySelector(`input[name="${key}"][value="${data[key]}"]`).checked = true;
                } else {
                    element.value = data[key];
                }
            }
        }
    }
}

function clearFormData() {
    form.reset();
    localStorage.removeItem('cdMediaFormData');
    showStatus('フォームをクリアしました。', 'info');
    cdNumberInput.focus(); // CD連番フィールドにフォーカス
}

// --- メッセージ表示 ---
function showStatus(message, type) {
    formStatus.textContent = message;
    formStatus.className = `message ${type}-message`;
    formStatus.style.display = 'block';
    setTimeout(() => { formStatus.style.display = 'none'; }, 5000);
}

// --- バーコードスキャナー (QuaggaJS - 静止画読み取り) ---
const barcodeInput = document.getElementById('barcode_input');
const scanImageButton = document.getElementById('scan-image-button');
const barcodeFileInput = document.getElementById('barcode-file-input');
const barcodeFormatDiv = document.getElementById('barcode-format');

scanImageButton.addEventListener('click', () => {
    barcodeFileInput.click(); // ファイル選択ダイアログを開く
});

barcodeFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        return;
    }

    const imageUrl = URL.createObjectURL(file);
    showStatus('画像を解析中...', 'info');

    Quagga.decodeSingle({
        src: imageUrl,
        numOfWorkers: navigator.hardwareConcurrency || 4,
        decoder: {
            readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "upc_reader"]
        },
        locate: true, // より詳細な探索を有効にする
    }, (result) => {
        URL.revokeObjectURL(imageUrl); // メモリリークを防ぐ

        if (result && result.codeResult) {
            const code = result.codeResult.code;
            if (/^[A-Za-z]/.test(code)) {
                barcodeInput.value = code;
                barcodeFormatDiv.textContent = `検出フォーマット: ${result.codeResult.format}`;
                showStatus(`バーコードを検出: ${code}`, 'success');
            } else {
                showStatus(`英字で始まらないため無視: ${code}`, 'error');
            }
        } else {
            showStatus('バーコードが検出できませんでした。再撮影してください。', 'error');
        }
    });
});