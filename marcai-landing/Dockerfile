FROM node:20-alpine AS builder

ARG VITE_LANDING_BASE_URL=https://marcaí.com
ENV VITE_LANDING_BASE_URL=$VITE_LANDING_BASE_URL

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
