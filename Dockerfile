# Use official Node.js image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port (will be mapped in docker-compose.yml)
EXPOSE 3050

# Start the application
CMD ["node", "server.js"]