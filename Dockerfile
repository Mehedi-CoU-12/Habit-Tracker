# 1. Base image
FROM node:20-alpine

# 2. Install pnpm
RUN npm install -g pnpm

# 3. Set working directory
WORKDIR /app

# 4. Copy everything first
COPY . .

# 5. Install all dependencies
RUN pnpm install

# 6. Expose port
EXPOSE 3000

# 7. Start in dev mode
CMD ["pnpm", "run", "dev"]