FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy sources
COPY . .

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Expose port
EXPOSE 3000
ENV PORT=3000

# Start Next.js in production mode
CMD ["sh", "-c", "node generate-env.js && npm start"]
