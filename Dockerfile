# Stage 1: Build the app
FROM node:18-alpine AS builder
WORKDIR /app
COPY peek/package*.json ./
RUN npm ci --ignore-scripts
COPY peek/ ./
# Serve from / when running in Docker (not GitHub Pages sub-path)
ENV VITE_BASE_PATH=/
RUN npm run build

# Stage 2: Serve the dashboard with nginx and proxy /_es/* to Elasticsearch
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# nginx:alpine processes templates in /etc/nginx/templates/ at startup,
# substituting environment variables (e.g. ${ES_URL}) via envsubst.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
