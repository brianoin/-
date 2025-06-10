# 使用 Node.js 官方映像檔作為基礎
FROM node:18

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製所有檔案到工作目錄
COPY . .

# 暴露 8080 端口
EXPOSE 8080

# 啟動應用程式
CMD ["node", "server.js"] 