let guessCount = 0;
let startTime; // 記錄遊戲開始時間

// Firebase 配置 - ***請務必替換為您自己的 Firebase 專案配置！***
// 這些是範例值，直接使用會導致無法連線到您的資料庫。
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // <-- 替換成您的實際 API Key
    authDomain: "YOUR_AUTH_DOMAIN.firebaseapp.com", // <-- 替換成您的實際 Auth Domain
    databaseURL: "YOUR_DATABASE_URL.firebasedatabase.app", // <-- 替換成您的實際 Database URL
    projectId: "YOUR_PROJECT_ID", // <-- 替換成您的實際 Project ID
    storageBucket: "YOUR_STORAGE_BUCKET.appspot.com", // <-- 替換成您的實際 Storage Bucket
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // <-- 替換成您的實際 Messaging Sender ID
    appId: "YOUR_APP_ID" // <-- 替換成您的實際 App ID
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 玩家名稱
let player = "";
let secretNumber = []; // 遊戲答案
let guessHistory = []; // 儲存猜測歷史

// 音效元素
const winSound = document.getElementById('winSound');
const loseSound = document.getElementById('loseSound');

// 當 DOM 完全載入後執行
document.addEventListener('DOMContentLoaded', () => {
    // 獲取 DOM 元素
    const guessInput = document.getElementById('guessInput');
    const guessButton = document.getElementById('guessButton');
    const giveUpButton = document.getElementById('giveUpButton');
    const restartButton = document.getElementById('restartButton');
    const answerButton = document.getElementById('answerButton');
    const resultDisplay = document.getElementById('result');
    const answerDisplay = document.getElementById('answer');
    const answerSpan = document.getElementById('answer').querySelector('.secret-number');
    const leaderboardModal = document.getElementById('leaderboardModal'); // 獲取 modal 元素

    // 遊戲初始化
    initGame(); // 頁面載入時先初始化遊戲狀態

    // 生成四個不重複的數字
    function generateSecretNumber() {
        const digits = Array.from({ length: 10 }, (_, i) => i);
        shuffleArray(digits);
        return digits.slice(0, 4).map(String);
    }

    // 洗牌演算法 (Fisher-Yates)
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 檢查猜測並返回 A 和 B 的數量
    function checkGuess(guess) {
        let a = 0;
        let b = 0;
        const secret = [...secretNumber];
        const guessed = [...guess];

        // 計算 A (數字和位置都正確)
        for (let i = 0; i < 4; i++) {
            if (guessed[i] === secret[i]) {
                a++;
                secret[i] = '*'; // 標記已匹配的數字，避免重複計算
                guessed[i] = '#'; // 標記已匹配的猜測，避免重複計算
            }
        }

        // 計算 B (數字正確但位置錯誤)
        for (let i = 0; i < 4; i++) {
            if (guessed[i] !== '#') { // 如果這個猜測數字還沒有被算作 A
                for (let j = 0; j < 4; j++) {
                    if (guessed[i] === secret[j]) { // 如果猜測數字在答案中存在
                        b++;
                        secret[j] = '*'; // 標記已匹配的數字
                        break; // 找到一個就跳出內層循環
                    }
                }
            }
        }
        return { a, b };
    }

    // 更新結果顯示
    function updateResultDisplay() {
        resultDisplay.innerHTML = ''; // 清空舊的顯示
        guessHistory.forEach(item => {
            const div = document.createElement('div');
            let className = '';
            if (item.result === '4A0B') {
                className = 'correct';
            } else if (item.result.includes('A') || item.result.includes('B')) {
                // 如果是 0A0B 就不應該是 partial
                if (item.result !== '0A0B') {
                    className = 'partial';
                } else {
                    className = 'incorrect'; // 0A0B 應該是 incorrect
                }
            } else {
                className = 'incorrect';
            }
            div.className = className;
            div.textContent = `第 ${item.count} 次猜測：${item.guess} -> ${item.result}`;
            resultDisplay.appendChild(div);
        });
        resultDisplay.scrollTop = resultDisplay.scrollHeight; // 滾動到最新結果
    }

    // 處理猜測按鈕點擊
    guessButton.addEventListener('click', () => {
        const guess = guessInput.value;

        // 驗證輸入
        if (!/^\d{4}$/.test(guess)) {
            alert('請輸入四個數字！');
            return;
        }
        if (new Set(Array.from(guess)).size !== 4) {
            alert('請輸入四個不重複的數字！');
            return;
        }

        guessCount++;
        const { a, b } = checkGuess(guess);
        const result = `${a}A${b}B`;
        guessHistory.push({ count: guessCount, guess: guess, result: result });
        updateResultDisplay();
        guessInput.value = ''; // 清空輸入框

        if (a === 4) {
            winSound.play(); // 播放勝利音效
            const timeTaken = Math.round((Date.now() - startTime) / 1000); // 計算花費時間 (秒)
            alert(`恭喜你猜對了！答案是 ${secretNumber.join('')}，總共猜了 ${guessCount} 次，花費 ${timeTaken} 秒。`);
            recordScore(guessCount, timeTaken); // 記錄分數和時間
            showAnswerAndRestart();
            disableGame();
        }
    });

    // 處理放棄按鈕點擊
    giveUpButton.addEventListener('click', () => {
        loseSound.play(); // 播放失敗音效
        answerSpan.textContent = secretNumber.join('');
        answerDisplay.style.display = 'block';
        showRestartButton();
        disableGame();
        alert(`你放棄了，答案是 ${secretNumber.join('')}。`);
    });

    // 處理顯示答案按鈕點擊
    answerButton.addEventListener('click', () => {
        answerSpan.textContent = secretNumber.join('');
        answerDisplay.style.display = 'block';
    });

    // 處理重新挑戰按鈕點擊
    restartButton.addEventListener('click', () => {
        initGame(); // 重新初始化遊戲
    });

    // 顯示答案並顯示重新挑戰按鈕
    function showAnswerAndRestart() {
        answerSpan.textContent = secretNumber.join('');
        answerDisplay.style.display = 'block';
        showRestartButton();
    }

    // 顯示重新挑戰按鈕
    function showRestartButton() {
        restartButton.style.display = 'inline-block';
    }

    // 禁用遊戲操作
    function disableGame() {
        guessInput.disabled = true;
        guessButton.disabled = true;
        giveUpButton.disabled = true;
        answerButton.disabled = true; // 禁用答案按鈕
    }

    // 啟用遊戲操作
    function enableGame() {
        guessInput.disabled = false;
        guessButton.disabled = false;
        giveUpButton.disabled = false;
        answerButton.disabled = false; // 啟用答案按鈕
        guessInput.focus();
    }

    // 初始化遊戲狀態
    function initGame() {
        secretNumber = generateSecretNumber();
        guessCount = 0;
        guessHistory = [];
        resultDisplay.innerHTML = '';
        answerDisplay.style.display = 'none';
        restartButton.style.display = 'none';
        guessInput.value = '';
        enableGame();
        startTime = Date.now(); // 記錄遊戲開始時間
        // console.log("答案已生成：", secretNumber.join('')); // 開發時可取消註解查看答案
    }

    // ======== 全局函數 (確保它們在 DOMContentLoaded 外部以便 HTML 直接調用) ========

    // 開始遊戲 (從開始畫面進入遊戲畫面)
    window.startGame = function() {
        const nameInput = document.getElementById("playerName").value.trim();
        if (!nameInput) {
            alert("請輸入玩家名稱");
            return;
        }
        player = nameInput;
        document.getElementById("displayName").innerText = player;
        document.getElementById("startScreen").style.display = "none";
        document.getElementById("gameScreen").style.display = "block";
        document.getElementById('guessInput').focus(); // 自動聚焦輸入框
        startTime = Date.now(); // 設定遊戲開始時間
    };

    // 記錄分數到 Firebase
    window.recordScore = function(attempts, time) {
        db.ref("leaderboard").push({
            name: player,
            attempts: attempts,
            time: time, // 記錄時間 (秒)
            timestamp: Date.now()
        }).catch(error => {
            console.error("寫入排行榜失敗:", error);
            alert("記錄分數失敗，請檢查網路連線或 Firebase 設定。");
        });
    };

    // 顯示排行榜彈跳視窗
    window.showLeaderboard = function() {
        const tbody = document.getElementById("leaderboardTableBody");
        tbody.innerHTML = "<tr><td colspan='4'>載入中...</td></tr>"; // 載入中提示
        leaderboardModal.classList.add('is-active'); // 添加 class 顯示 modal

        db.ref('leaderboard')
            .orderByChild('attempts') // 按嘗試次數排序
            .limitToFirst(10) // 取前 10 名
            .once('value', snapshot => {
                tbody.innerHTML = ""; // 清空現有內容
                let rank = 1;
                if (!snapshot.hasChildren()) {
                    tbody.innerHTML = "<tr><td colspan='4'>目前沒有排行榜資料</td></tr>";
                    return;
                }
                snapshot.forEach(child => {
                    const data = child.val();
                    const tr = document.createElement("tr");
                    const displayTime = data.time ? `${data.time} 秒` : 'N/A';
                    tr.innerHTML = `
                        <td>${rank++}</td>
                        <td>${data.name}</td>
                        <td>${data.attempts}</td>
                        <td>${displayTime}</td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(error => {
                console.error("載入排行榜失敗:", error);
                tbody.innerHTML = "<tr><td colspan='4'>載入排行榜失敗</td></tr>";
            });
    };

    // 隱藏排行榜彈跳視窗
    window.hideLeaderboard = function() {
        leaderboardModal.classList.remove('is-active'); // 移除 class 隱藏 modal
    };
}); // DOMContentLoaded 結束
}

// 隱藏排行榜彈跳視窗
function hideLeaderboard() {
    document.getElementById("leaderboardModal").style.display = "none";
}
