FROM node:20-bullseye-slim

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# ADDED: procps (provides 'ps' command needed by puppeteer-real-browser/xvfb-run)
RUN apt-get update \
    && apt-get install -y wget gnupg xauth procps \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      xvfb \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Fix: user 1000 might already exist in node image
RUN id -u 1000 &>/dev/null || useradd -m -u 1000 user
USER 1000
ENV PATH="/home/user/.local/bin:$PATH"
ENV PORT=7860

WORKDIR /app

COPY --chown=1000 package.json ./
RUN npm install

COPY --chown=1000 . .

# Launch with xvfb-run to support headless: false
CMD ["xvfb-run", "--auto-servernum", "--server-args='-screen 0 1280x800x24'", "node", "scraper.js"]
