FROM node:lts-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目文件
COPY . .

# 构建 Next.js 应用
RUN npx next build

# 暴露 Next.js 默认端口
EXPOSE 3000

# 启动 Next.js 生产服务器
CMD ["npx", "next", "start"]
