# Use Alpine base image
FROM alpine:latest

# Install Nginx for config testing
RUN apk add --no-cache nginx

# Copy the Nginx configuration file
COPY nginx.conf /nginx.conf

# Command to update host Nginx config and test
CMD sh -c "cp -f /nginx.conf /sites-available/flapi.serp24.online && \
           ln -sf /sites-available/flapi.serp24.online /sites-enabled/flapi.serp24.online && \
           ls -l /sites-enabled/flapi.serp24.online && \
           /usr/sbin/nginx -t -c /sites-available/flapi.serp24.online && echo 'NGINX config test passed' || echo 'NGINX config test failed'"