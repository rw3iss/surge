FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
COPY shared/package*.json shared/

RUN npm ci

# Copy source
COPY . .

# Build shared types
RUN npm run build -w shared

# Build backend
RUN npm run build -w backend

# Expose port
EXPOSE 3001

# Start backend
CMD ["npm", "start", "-w", "backend"]
