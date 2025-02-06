const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    // CORSヘッダーを追加
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONSリクエストへの対応
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'GET') {
        // デフォルトルートへのアクセスをindex.htmlにリダイレクト
        let filePath = req.url === '/' ? './index.html' : '.' + req.url;

        // ファイルの拡張子に基づいてContent-Typeを設定
        const extname = path.extname(filePath);
        let contentType = 'text/html';
        switch (extname) {
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.css':
                contentType = 'text/css';
                break;
            case '.mp4':
                contentType = 'video/mp4';
                break;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
    } else if (req.method === 'POST' && req.url === '/save-audio') {
        // 音声データの保存
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const audioData = Buffer.concat(chunks);
            const now = new Date();
            const filename = `recording_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}.wav`;

            // audio_dataディレクトリが存在しない場合は作成
            const audioDir = 'audio_data';
            if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir);
            }

            // audio_dataディレクトリにファイルを保存
            fs.writeFile(path.join(audioDir, filename), audioData, (err) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error saving file');
                    return;
                }
                res.writeHead(200);
                res.end('File saved successfully');
            });
        });
    }
});

server.listen(5500, () => {
    console.log('Server running at http://localhost:5500/');
}); 