let guessCount = 0;
let startTime; // 新增變數來記錄遊戲開始時間
let selectedDifficulty = 4; // 預設難度為 4 位數

// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyCoDjR058s-OkYYYPYXsbH_IrjgP8ZH1Qc",
    authDomain: "game-fd471.firebaseapp.com",
    databaseURL: "https://game-fd471-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "game-fd471",
    storageBucket: "game-fd471.firebasestorage.app",
    messagingSenderId: "829125391460",
    appId: "1:829125391460:web:52418f8d5b2dc8938fdb71"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 玩家名稱
let player = "";
let secretNumber = []; // 遊戲答案
let guessHistory = []; // 儲存猜測歷史

// 音效元素
const winSound = document.getElementById('winSound');
const loseSound = document.getElementById('loseSound');

document.addEventListener('DOMContentLoaded', () => {
    const difficultySelect = document.getElementById('difficulty');
    const guessInput = document.getElementById('guessInput');
    const guessButton = document.getElementById('guessButton');
    const giveUpButton = document.getElementById('giveUpButton');
    const restartButton = document.getElementById('restartButton');
    const resultDisplay = document.getElementById('result');
    const answerDisplay = document.getElementById('answer');
    const answerSpan = document.getElementById('answer').querySelector('.secret-number');
    const gameTitle = document.getElementById('gameTitle');
    const gameDescription = document.getElementById('gameDescription');
    const displayLevel = document.getElementById('displayLevel'); // 獲取等級顯示元素

    // 監聽難度選擇變化
    difficultySelect.addEventListener('change', (event) => {
        selectedDifficulty = parseInt(event.target.value);
        // 根據難度更新輸入框的 maxlength 和 pattern
        guessInput.maxLength = selectedDifficulty;
        gameDescription.textContent = `試著猜出${selectedDifficulty}個不重複的數字 (0-9)：`;
        // 在這裡不需要重新初始化遊戲，因為還沒開始
    });


    // 生成指定數量且不重複的數字
    function generateSecretNumber(count) {
        const digits = Array.from({ length: 10 }, (_, i) => i);
        shuffleArray(digits);
        return digits.slice(0, count).map(String);
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
        const secret = [...secretNumber]; // 複製一份，避免修改原始答案
        const guessed = [...guess]; // 複製一份，避免修改原始猜測

        // 計算 A (數字和位置都正確)
        for (let i = 0; i < selectedDifficulty; i++) {
            if (guessed[i] === secret[i]) {
                a++;
                secret[i] = '*'; // 標記已匹配的數字，避免重複計算 B
                guessed[i] = '#'; // 標記已匹配的猜測，避免重複計算 B
            }
        }

        // 計算 B (數字正確但位置錯誤)
        for (let i = 0; i < selectedDifficulty; i++) {
            if (guessed[i] !== '#') { // 如果這個猜測數字還沒有被算作 A
                for (let j = 0; j < selectedDifficulty; j++) {
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
            if (item.result === `${selectedDifficulty}A0B`) { // 根據難度判斷勝利
                className = 'correct';
            } else if (item.result.includes('A') || item.result.includes('B')) {
                className = 'partial';
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

        // 驗證輸入長度和重複性
        if (guess.length !== selectedDifficulty || new Set(Array.from(guess)).size !== selectedDifficulty) {
            alert(`請輸入${selectedDifficulty}個不重複的數字！`);
            return;
        }

        guessCount++;
        const { a, b } = checkGuess(guess);
        const result = `${a}A${b}B`;
        guessHistory.push({ count: guessCount, guess: guess, result: result });
        updateResultDisplay();
        guessInput.value = ''; // 清空輸入框

        if (a === selectedDifficulty) { // 根據難度判斷勝利
            winSound.play(); // 播放勝利音效
            const timeTaken = Math.round((Date.now() - startTime) / 1000); // 計算花費時間 (秒)
            alert(`恭喜你猜對了！答案是 ${secretNumber.join('')}，總共猜了 ${guessCount} 次，花費 ${timeTaken} 秒。`);
            recordScore(guessCount, timeTaken, selectedDifficulty); // 記錄分數和時間，傳入難度
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
    }

    // 啟用遊戲操作
    function enableGame() {
        guessInput.disabled = false;
        guessButton.disabled = false;
        giveUpButton.disabled = false;
        guessInput.focus();
    }

    // 初始化遊戲狀態
    function initGame() {
        // 根據選擇的難度生成數字
        secretNumber = generateSecretNumber(selectedDifficulty);
        guessCount = 0;
        guessHistory = [];
        resultDisplay.innerHTML = '';
        answerDisplay.style.display = 'none';
        restartButton.style.display = 'none';
        guessInput.value = '';
        guessInput.maxLength = selectedDifficulty; // 更新輸入框長度
        gameDescription.textContent = `試著猜出${selectedDifficulty}個不重複的數字 (0-9)：`; // 更新描述
        enableGame();
        startTime = Date.now(); // 記錄遊戲開始時間
        loadLeaderboard(); // 遊戲重新開始時也更新排行榜
        // console.log("答案已生成：", secretNumber.join('')); // 開發時可取消註解查看答案
    }

    // 確保頁面加載後初始化遊戲
    initGame(); // 初始載入時也執行一次
});

// 開始遊戲 (從開始畫面進入遊戲畫面)
function startGame() {
    const nameInput = document.getElementById("playerName").value.trim();
    if (!nameInput) {
        alert("請輸入玩家名稱");
        return;
    }
    player = nameInput;
    // 獲取選擇的難度，並更新全局變數
    selectedDifficulty = parseInt(document.getElementById('difficulty').value);

    // 更新顯示的玩家名稱和等級
    document.getElementById("displayName").innerText = player;
    document.getElementById("displayLevel").innerText = `${selectedDifficulty} 位數`; // 更新等級顯示

    document.getElementById("startScreen").style.display = "none";
    document.getElementById("gameScreen").style.display = "flex"; // 使用 flex 佈局
    document.getElementById('guessInput').focus(); // 自動聚焦輸入框

    // 根據難度更新遊戲標題和描述
    document.getElementById('gameTitle').textContent = `猜數字遊戲 (${selectedDifficulty} 位數)`;
    document.getElementById('gameDescription').textContent = `試著猜出${selectedDifficulty}個不重複的數字 (0-9)：`;

    // 確保輸入框的長度正確
    document.getElementById('guessInput').maxLength = selectedDifficulty;

    startTime = Date.now(); // 設定遊戲開始時間
    initGame(); // 調用 initGame 來設定新的遊戲狀態
    loadLeaderboard(); // 遊戲開始時載入排行榜
}

// 記錄分數到 Firebase，新增 difficulty 參數
function recordScore(attempts, time, difficulty) {
    // 建立一個以難度為路徑的分支，例如 /leaderboard/4digits/ 或 /leaderboard/5digits/
    const path = `leaderboard/${difficulty}digits`;
    db.ref(path).push({
        name: player,
        attempts: attempts,
        time: time, // 記錄時間
        timestamp: Date.now()
    }).then(() => {
        loadLeaderboard(); // 記錄分數後重新載入排行榜
    }).catch(error => {
        console.error("寫入排行榜失敗:", error);
        alert("記錄分數失敗，請檢查網路連線或 Firebase 設定。");
    });
}

// 載入並顯示排行榜，現在根據當前選擇的難度載入
function loadLeaderboard() {
    const tbody = document.getElementById("leaderboardTableBody");
    tbody.innerHTML = "<tr><td colspan='4'>載入中...</td></tr>"; // 載入中提示

    // 根據當前難度載入排行榜
    const path = `leaderboard/${selectedDifficulty}digits`;
    db.ref(path)
        .orderByChild('attempts') // 按嘗試次數排序
        .limitToFirst(10) // 取前 10 名
        .once('value', snapshot => {
            tbody.innerHTML = ""; // 清空現有內容
            let rank = 1;
            if (!snapshot.hasChildren()) {
                tbody.innerHTML = "<tr><td colspan='4'>目前沒有排行榜資料</td></tr>";
                return;
            }
            // 將數據轉換為陣列並按嘗試次數、時間、時間戳排序
            let scores = [];
            snapshot.forEach(child => {
                scores.push(child.val());
            });

            scores.sort((a, b) => {
                if (a.attempts !== b.attempts) {
                    return a.attempts - b.attempts; // 嘗試次數越少越好
                }
                if (a.time !== b.time) {
                    return a.time - b.time; // 時間越短越好
                }
                return a.timestamp - b.timestamp; // 時間戳越早越好
            });

            scores.slice(0, 10).forEach(data => { // 只顯示前10名
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${rank++}</td>
                    <td>${data.name}</td>
                    <td>${data.attempts}</td>
                    <td>${data.time ? data.time + ' 秒' : 'N/A'}</td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(error => {
            console.error("載入排行榜失敗:", error);
            tbody.innerHTML = "<tr><td colspan='4'>載入排行榜失敗</td></tr>";
        });
}
