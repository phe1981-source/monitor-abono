# Esta imagen ya trae Chrome y todas las librerías necesarias preinstaladas
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de dependencias y los instala
COPY package*.json ./
RUN npm install

# Copia el resto del código de tu proyecto
COPY . .

# Comando para arrancar el bot
CMD ["node", "index.js"]
