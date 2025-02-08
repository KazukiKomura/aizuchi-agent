class AizuchiSystem {
    constructor(audioCtx, analyzer) {
        this.audioCtx = audioCtx;
        this.analyzer = analyzer;
        this.f0Array = [];
        this.lastAizuchiTime = Date.now();

        // 論文に基づくパラメータ設定
        this.F0_THRESHOLD = 0.2;          // F0が平均値から20%低下
        this.AIZUCHI_COOLDOWN = 2000;     // 相槌後2秒間は新しい相槌を抑制
        this.PHRASE_END_DELAY = 250;      // フレーズ終了予測までの待機時間 (0.25秒)
        this.AIZUCHI_DELAY = 300;         // 相槌までの最大遅延時間 (0.3秒)
        this.VOLUME_THRESHOLD = -50;       // 音声検出のための閾値 (dB)
        this.CHECK_INTERVAL = 50;         // 発話継続チェックの間隔 (50ms)

        this.AIZUCHI_TYPES = ['うん', 'はい', 'ええ'];
        this.isSpeakingCheck = null;      // 発話継続チェック用のインターバルID
        this.pendingAizuchi = null;       // 予定された相槌のタイムアウトID

        console.log('相槌システムを初期化しました');
    }

    detectF0(dataArray) {
        const bufferLength = dataArray.length;
        let maxCorrelation = 0;
        let f0 = 0;
        const sampleRate = this.audioCtx.sampleRate;

        let signalPower = 0;
        for (let i = 0; i < bufferLength; i++) {
            signalPower += dataArray[i] * dataArray[i];
        }
        console.log(`[DEBUG] Signal Power: ${signalPower}`);

        const minLag = Math.floor(sampleRate / 500);  // 500Hz
        const maxLag = Math.floor(sampleRate / 50);     // 50Hz

        for (let lag = minLag; lag < maxLag; lag++) {
            let correlation = 0;
            for (let i = 0; i < bufferLength - lag; i++) {
                correlation += dataArray[i] * dataArray[i + lag];
            }
            correlation = correlation / signalPower;
            // 詳細なデバッグ情報（必要に応じてコメントアウトを外してください）
            // console.log(`[DEBUG] Lag: ${lag}, Correlation: ${correlation}`);

            if (correlation > maxCorrelation) {
                maxCorrelation = correlation;
                f0 = sampleRate / lag;
            }
        }

        console.log(`[DEBUG] maxCorrelation: ${maxCorrelation}, detected f0: ${f0}`);
        return maxCorrelation < 0.5 ? 0 : f0;
    }

    getAverageF0() {
        if (this.f0Array.length === 0) return 0;
        return this.f0Array.reduce((a, b) => a + b) / this.f0Array.length;
    }

    checkVolumeLevel(dataArray) {
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const db = 20 * Math.log10(rms);
        return db > this.VOLUME_THRESHOLD;
    }

    showAizuchi() {
        const now = Date.now();
        if (now - this.lastAizuchiTime < this.AIZUCHI_COOLDOWN) {
            return;
        }
        console.log('相槌');
        // コンソールへのログ出力の代わりに、同じディレクトリ内の hai.mp3 を再生する
        const audio = new Audio('hai.m4a');
        audio.play().catch((error) => {
            console.error("音声ファイルの再生中にエラーが発生しました:", error);
        });

        this.lastAizuchiTime = now;
        this.f0Array = [];
    }

    cancelPendingAizuchi() {
        if (this.isSpeakingCheck) {
            clearInterval(this.isSpeakingCheck);
            this.isSpeakingCheck = null;
        }
        if (this.pendingAizuchi) {
            clearTimeout(this.pendingAizuchi);
            this.pendingAizuchi = null;
        }
    }

    update() {
        const now = Date.now();
        if (now - this.lastAizuchiTime < this.AIZUCHI_COOLDOWN) {
            return;
        }

        const dataArray = new Float32Array(this.analyzer.frequencyBinCount);
        this.analyzer.getFloatTimeDomainData(dataArray);

        // 現在の音量レベルを確認
        const volumeStatus = this.checkVolumeLevel(dataArray);
        console.log(`[DEBUG] Volume check: ${volumeStatus}`);

        const currentF0 = this.detectF0(dataArray);
        console.log(`[DEBUG] currentF0: ${currentF0}`);

        if (currentF0 > 0) {
            this.f0Array.push(currentF0);
            const avgF0 = this.getAverageF0();
            console.log(`[DEBUG] avgF0: ${avgF0}`);

            // F0が平均値から20%低下した場合
            if (currentF0 < avgF0 * (1 - this.F0_THRESHOLD)) {
                console.log(`[DEBUG] F0低下検出: currentF0=${currentF0}, threshold=${avgF0 * (1 - this.F0_THRESHOLD)}`);

                // 既存の予約をキャンセル
                this.cancelPendingAizuchi();

                let speakingDetected = false;

                // 発話継続チェック開始
                this.isSpeakingCheck = setInterval(() => {
                    const newDataArray = new Float32Array(this.analyzer.frequencyBinCount);
                    this.analyzer.getFloatTimeDomainData(newDataArray);

                    const newVolumeStatus = this.checkVolumeLevel(newDataArray);
                    console.log(`[DEBUG] 発話チェック中のVolume: ${newVolumeStatus}`);

                    // if (this.checkVolumeLevel(newDataArray)) {
                    //     speakingDetected = true;
                    //     console.log(`[DEBUG] 発話中と判定`);
                    //     this.cancelPendingAizuchi();
                    // }
                }, this.CHECK_INTERVAL);

                // 相槌予約
                this.pendingAizuchi = setTimeout(() => {
                    clearInterval(this.isSpeakingCheck);
                    if (!speakingDetected) {
                        console.log(`[DEBUG] 発話終了と判断され、相槌実施`);
                        this.showAizuchi();
                    } else {
                        console.log(`[DEBUG] 発話継続のため、相槌キャンセル`);
                    }
                }, this.PHRASE_END_DELAY + this.AIZUCHI_DELAY);
            }
        }
    }
}