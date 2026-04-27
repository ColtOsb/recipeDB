FROM php:8.2-apache

RUN docker-php-ext-install mysqli

RUN echo "memory_limit = 256M" > /usr/local/etc/php/conf.d/limits.ini && \
    echo "max_execution_time = 30" >> /usr/local/etc/php/conf.d/limits.ini

COPY src/ /var/www/html/
