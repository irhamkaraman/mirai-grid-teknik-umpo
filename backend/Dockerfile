FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (curl for healthchecks, git, php-cli & composer, redis-server & redis-tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    unzip \
    redis-server \
    redis-tools \
    php-cli \
    php-mbstring \
    php-xml \
    php-curl \
    php-zip \
    && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer \
    && chmod +x /usr/local/bin/composer \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
