FROM node:20-alpine

WORKDIR /app

# Install dependencies first (using npm install due to lock file sync issues)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application for production
RUN npm run build

# Expose port
EXPOSE 3000

# Serve the built application
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]
