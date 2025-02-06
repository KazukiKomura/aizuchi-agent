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

        const minLag = Math.floor(sampleRate / 500);  // 500Hz
        const maxLag = Math.floor(sampleRate / 50);   // 50Hz

        for (let lag = minLag; lag < maxLag; lag++) {
            let correlation = 0;
            for (let i = 0; i < bufferLength - lag; i++) {
                correlation += dataArray[i] * dataArray[i + lag];
            }
            correlation = correlation / signalPower;

            if (correlation > maxCorrelation) {
                maxCorrelation = correlation;
                f0 = sampleRate / lag;
            }
        }

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

        const randomAizuchi = this.AIZUCHI_TYPES[Math.floor(Math.random() * this.AIZUCHI_TYPES.length)];
        console.log(`相槌: ${randomAizuchi}`);
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

        const currentF0 = this.detectF0(dataArray);

        if (currentF0 > 0) {
            this.f0Array.push(currentF0);
            const avgF0 = this.getAverageF0();

            // F0が平均値から20%低下した場合
            if (currentF0 < avgF0 * (1 - this.F0_THRESHOLD)) {
                this.cancelPendingAizuchi(); // 既存の予定をキャンセル

                let speakingDetected = false;

                // 発話継続チェックの開始
                this.isSpeakingCheck = setInterval(() => {
                    const newDataArray = new Float32Array(this.analyzer.frequencyBinCount);
                    this.analyzer.getFloatTimeDomainData(newDataArray);

                    if (this.checkVolumeLevel(newDataArray)) {
                        speakingDetected = true;
                        this.cancelPendingAizuchi();
                    }
                }, this.CHECK_INTERVAL);

                // 相槌の予約
                this.pendingAizuchi = setTimeout(() => {
                    clearInterval(this.isSpeakingCheck);
                    if (!speakingDetected) {
                        this.showAizuchi();
                    }
                }, this.PHRASE_END_DELAY + this.AIZUCHI_DELAY);
            }
        }
    }
}