# Node.js の lightweight な公式イメージを利用
FROM node:18-slim

# 作業ディレクトリを作成
WORKDIR /app

# package.json（存在する場合）と package-lock.json を先にコピーし、npm install のキャッシュを有効にする
COPY package*.json ./

# package.json が存在する場合のみ依存関係のインストールを実行
RUN if [ -f package.json ]; then npm install; fi

# プロジェクトの全ファイルをコンテナ内にコピー
COPY . .

# アプリケーションがリッスンするポートを公開
EXPOSE 5500

# サーバーを起動（server.js がエントリーポイント）
CMD [ "node", "server.js" ] 