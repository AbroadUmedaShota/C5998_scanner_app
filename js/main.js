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

// --- バーコードスキャナー (QuaggaJS) ---
const barcodeInput = document.getElementById('barcode_input');
const startScannerBtn = document.getElementById('startScanner');
const stopScannerBtn = document.getElementById('stopScanner');
const barcodeFormatDiv = document.getElementById('barcode-format');
const readerSelect = document.getElementById('reader-select');
let scannerRunning = false;

const ALL_READERS = ["code_39_reader", "code_128_reader", "i2of5_reader", "ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"];

readerSelect.addEventListener('change', () => {
    if (scannerRunning) {
        stopScanner();
        startScanner(); // リーダー切り替え後、スキャナーを再起動
    }
});

function startScanner() {
    if (scannerRunning) return;
    showStatus('スキャナーを起動しています...', 'info');

    const selectedReader = readerSelect.value;
    const readersToUse = selectedReader === "auto" ? ALL_READERS : [selectedReader];

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#interactive'),
            constraints: { facingMode: "environment" }
        },
        decoder: {
            readers: readersToUse
        }
    }, (err) => {
        if (err) { showStatus(`スキャナーの起動に失敗: ${err.message}`, 'error'); return; }
        Quagga.start();
        scannerRunning = true;
        showStatus('スキャナー起動済み。バーコードをカメラに...', 'info');
    });

    Quagga.onDetected((data) => {
        if (data && data.codeResult) {
            barcodeInput.value = data.codeResult.code;
            barcodeFormatDiv.textContent = `検出フォーマット: ${data.codeResult.format}`;
            showStatus(`バーコードを検出: ${data.codeResult.code}`, 'success');
            stopScanner();
        }
    });

    Quagga.onProcessed(function(result) {
        var drawingCtx = Quagga.canvas.ctx.overlay,
            drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            if (result.boxes) {
                drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.width), parseInt(drawingCanvas.height));
                result.boxes.filter(function (box) {
                    return box !== result.box;
                }).forEach(function (box) {
                    Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
                });
            }

            if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "#00F", lineWidth: 2 });
            }

            if (result.codeResult && result.codeResult.code) {
                Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: "red", lineWidth: 3 });
            }
        }
    });
}
function stopScanner() {
    if (scannerRunning) { Quagga.stop(); scannerRunning = false; showStatus('スキャナーを停止しました。', 'info'); }
}
startScannerBtn.addEventListener('click', startScanner);
stopScannerBtn.addEventListener('click', stopScanner);