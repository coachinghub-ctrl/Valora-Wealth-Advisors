# VALORA — valorawealthadvisors.com

Landing de una sola página para VALORA · *Financial Wellness*.
HTML, CSS y JS sin dependencias ni paso de build: se publica tal cual en Vercel.

## Estructura

```
index.html      la página completa (14 secciones + pie)
styles.css      todo el diseño — la paleta de marca vive en :root
script.js       menú, revelado al hacer scroll, acordeón de FAQ y formulario
api/lead.js     función que recibe el formulario y lo envía por correo (Resend)
assets/         logo, marca, retratos, favicon e imagen social
vercel.json     cache de assets y cabeceras de seguridad
robots.txt      indexación
sitemap.xml     mapa del sitio
```

## Marca

| | |
|---|---|
| Azul oscuro | `#081D42` — base |
| Azul claro | `#285BCB` — acentos digitales |
| Dorado | `#C9A84C` — detalles premium |
| Títulos | Cormorant Garamond |
| Nombre de marca | Cinzel |
| Texto | Montserrat |

Los colores están como variables CSS al inicio de `styles.css`; cambiarlos ahí
cambia toda la página.

### Assets

`logo.png` es el lockup (marca + VALORA + filete) **sin bajada de línea**: el
texto *Financial Wellness* se compone en HTML debajo, así que cambiarlo no
requiere volver a exportar la imagen. `mark.png` es solo la V.

## Ver en local

```bash
cd ~/Desktop/Valora/web && python3 -m http.server 4321
```

El formulario no funciona en local (no hay funciones serverless); muestra el
mensaje de respaldo con el correo de contacto.

## Publicar en Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En Vercel: **Add New → Project → Import** ese repositorio.
   Framework Preset: **Other**. Sin build command, sin output directory.
3. Deploy.

### Variables de entorno (para que el formulario envíe)

En **Settings → Environment Variables** del proyecto:

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | la clave de Resend |
| `LEAD_TO` | a dónde llegan los leads, p. ej. `info@valoraprotection.com` (acepta varios separados por coma) |
| `LEAD_FROM` | remitente verificado en Resend, p. ej. `VALORA <web@valorawealthadvisors.com>` |

Sin estas tres variables el endpoint responde 500 y la página muestra el
mensaje de respaldo. Hay que redeployar después de agregarlas.

### Dominio en Dynadot

En Vercel, **Settings → Domains**, agrega `valorawealthadvisors.com` y
`www.valorawealthadvisors.com`. Luego en Dynadot, en el DNS del dominio:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` | `216.150.1.1` |
| CNAME | `www` | `cname.vercel-dns.com` |

Vercel confirma los valores exactos en pantalla — si difieren, manda Vercel.
El certificado SSL se emite solo cuando el DNS propaga (minutos a un par de horas).

Si el correo de leads sale desde este dominio, Resend pedirá además sus
registros SPF/DKIM/DMARC en la misma zona DNS.

## Pendientes

### Contenido que falta
- **Testimonios:** las tres tarjetas de «Lo que dicen nuestras familias» traen el
  texto de ejemplo del mockup, con nombres y ciudades inventados. Son
  declaraciones atribuidas a personas reales: **hay que reemplazarlas por
  testimonios auténticos y autorizados antes de publicar.**
- **Redes sociales:** los cuatro enlaces del pie apuntan a `#`. Faltan las URLs
  de Facebook, Instagram, YouTube y LinkedIn.
- **WhatsApp:** la constante `WHATSAPP` al inicio de `script.js` está vacía.
  Con el número en formato internacional (`13051234567`), el botón «Hablar con
  un estratega» y el mensaje de respaldo del formulario pasan a WhatsApp.
- **Páginas legales:** el pie enlaza `/aviso-legal`, `/privacidad` y
  `/terminos`, que todavía no existen. Además faltan las divulgaciones de
  licencias de seguros que suelen exigirse en USA.
- **Correo:** el pie usa `info@valoraprotection.com` mientras el sitio vive en
  `valorawealthadvisors.com`. Conviene unificarlo.

### Logos de los carriers
Los ocho logos de `assets/carriers/` se descargaron de los sitios oficiales de
cada compañía (John Hancock desde Wikimedia Commons, porque su CDN bloquea la
descarga directa). **Son marcas registradas:** casi todos los carriers exigen
aprobación previa del agente y tienen guías de marca sobre tamaño, espacio libre
y contexto de uso. Conviene validarlo con el marketing rep de cada compañía
antes de publicar.

Falta el archivo oficial de **Ever Insurance** — su dominio está aparcado y no
encontré el sitio activo. Por ahora aparece compuesto tipográficamente.

El lockup de Dominion viene en blanco (pensado para fondo oscuro); se invierte
por CSS con `filter:invert(1)` en `.carrier-list .c-dom img`.
