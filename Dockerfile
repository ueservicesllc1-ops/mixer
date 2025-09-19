# Stage 1: Builder - Installs dependencies and builds the Next.js app
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 2: Runner - Creates the final, smaller production image
FROM node:20-alpine AS runner

WORKDIR /app

# Copy environment variables, though they should be injected at runtime
COPY .env .

# Copy the build output from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Expose the port the app runs on
EXPOSE 3000

# The command to start the app
CMD ["npm", "start"]
