<img width="1280" height="720" alt="69c8f302-c5f0-4ce0-8750-5487e2b8fd74" src="https://github.com/user-attachments/assets/c02f1a21-3e3c-4ea8-90f9-b529abcfe054" />

# Ulock-Security LinkShield AI

**🛡️Ulock-Security LinkShield AI** es una extensión de navegador diseñada para proteger tu seguridad en clientes de correo como Gmail, Outlook y en toda su navegacion por cualquier sitio web, advirtiendo visualmenta con recuadros de colores (🟢,🟠,🔴) segun su clasificacion cada enlace analizado. Utiliza un sistema de detección y análisis con IA de Gemini (su API KEY gratis) para identificar enlaces maliciosos en tiempo real, previniendo ataques de phishing y fraudes en la capa 8, la mas vulnerable que es el hombre.🛡️

## VIDEO:
[@p4im0n_hacking en TikTok](https://www.tiktok.com/@p4im0n_hacking/video/7528964714014067974?is_from_webapp=1&sender_device=pc&web_id=7520052095870993976)

<img src="https://i.ibb.co/bM04k7dk/photo-4965364468200180542-w.jpg" alt="photo-4965364468200180542-w" border="0">

<img src="https://i.ibb.co/M5VKcq2r/photo-4965364468200180541-w.jpg" alt="photo-4965364468200180541-w" border="0">

## Características Principales

-✅**Detección en tiempo real**: Analiza los enlaces dentro de tus correos y los marca visualmente según su nivel de riesgo (peligroso, dudoso o seguro).

 🟢 Verde: Para enlaces verificados y seguros.

 🟠 Naranja: Para enlaces dudosos (como acortadores o dominios extraños) que requieren precaución.

 🔴 Rojo: Para enlaces claramente peligrosos (IPs directas, dominios de phishing conocidos, etc.).
 
-🧠**Análisis con IA**: Permite un análisis profundo de cualquier enlace utilizando la potencia de la API de Google Gemini para obtener una segunda opinión.
-🌐**Integración con VirusTotal**: Abre directamente la página de VirusTotal para un dominio o IP específico para ver reportes de la comunidad.
-📊**Panel de Estadísticas**: Visualiza gráficos y datos sobre las detecciones, los dominios más bloqueados y tu nivel de cautela.
-✍️**Alta Personalización**: Configura la extensión a tu gusto, incluyendo listas blancas/negras de dominios y la posición del panel de análisis.

## Instalacion simple:
- Clonar el repositorio o directamente descargar el zip y descomprimir donde usted quiera.
- Luego en el navegador chrome navegar a chrome://extensions/ , arriba a la derecha presionar el deslizable para activar el modo "Modo Desarrollador".
- Luego arriba a la izquierda presionar "cargar descomprimida" y solo elija la carpeta qeu descomprimio, que contine directamente todos los archivos de la extension y aceptar.
- Y finalizando debajo en esa msima pagina, en la seccion "Todas las extensiones" le deberia aparecer la extension con el deslizable activado.
- Listo ya esta listo para navegar de manera segura con un guardian a su lado y no ser engañado en ningun phishing. (al aldo de la barra de busqueda estara el logo de la extension donde debera usar su API para el analisisi con IA, y tiene las distintas configuraciones y estadisticas con graficos) 

## ¿Cómo añadir dominios a la Lista Blanca o Negra?

Puedes personalizar la extensión para que ignore dominios de confianza o para que siempre bloquee dominios que consideres peligrosos.

1.  Haz clic en el icono de la extensión en tu navegador para abrir el panel.
2.  Ve a la pestaña **"Configuración"**.
3.  Busca las secciones **"Dominios en lista blanca"** y **"Dominios en lista negra"**.
4.  Escribe los dominios que deseas añadir, **uno por cada línea**.
    -   **Lista blanca**: Los enlaces a estos dominios siempre se considerarán seguros. Ideal para herramientas internas o sitios de confianza. (Ej: `intranet.miempresa.com`)
    -   **Lista negra**: Los enlaces a estos dominios siempre se marcarán como peligrosos.
5.  Haz clic en el botón **"Guardar Opciones"**. Los cambios se aplicarán inmediatamente.

## Para Desarrolladores: Añadir Soporte para Nuevos Clientes de Correo

Si deseas que la extensión funcione en un cliente de correo web que no está soportado por defecto (como un webmail corporativo), puedes añadirlo modificando los siguientes archivos:

### 1. `manifest.json`

Debes añadir el dominio del nuevo cliente de correo a la lista `matches` de los `content_scripts`. Esto permite que la extensión inyecte su código de análisis de enlaces en esa página.

Por ejemplo, para añadir soporte para `webmail.miempresa.com`:

```json
"content_scripts": [
  {
    "matches": [
      "https://mail.google.com/*",
      "https://outlook.live.com/*",
      "https://webmail.miempresa.com/*"
    ],
    "js": ["content.js"],
    "css": ["styles/panel.css"],
    "run_at": "document_idle"
  },
  {
    "matches": ["<all_urls>"],
    "exclude_matches": [
      "https://mail.google.com/*",
      "https://outlook.live.com/*",
      "https://webmail.miempresa.com/*"
    ],
...
```

### 2. `content.js` y `general_content.js`

Para evitar que la extensión marque como "dudosos" los enlaces internos del propio cliente de correo (como "Cerrar sesión" o "Configuración"), es recomendable añadir su dominio principal a la lista `dominiosSeguros` dentro de los archivos `content.js` y `general_content.js`.

```javascript
const dominiosSeguros = [
    'google.com', 'microsoft.com', 'live.com', 'outlook.com', 'apple.com',
    'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'youtube.com',
    'amazon.com', 'ebay.com', 'paypal.com', 'mercadolibre.com', 'github.com',
    'miempresa.com' // <-- Añadir el dominio principal aquí
];
```

Después de realizar estos cambios, recuerda recargar la extensión desde la página de `chrome://extensions/` para que se apliquen.
