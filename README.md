# VALORA — valorawealthadvisors.com

Landing de una sola página para VALORA · *Financial Wellness*.
HTML, CSS y JS sin dependencias ni paso de build: se publica tal cual en Vercel.

## Estructura

```
index.html      la portada
agenda.html     diagnóstico por pasos y solicitud de cita
admin.html      VALORA Operating System — panel interno
styles.css      diseño de la web pública (la paleta vive en :root)
admin.css       diseño del panel
script.js       menú, revelado al hacer scroll, acordeón y formulario
agenda.js       el asistente de siete pasos
admin.js        tablero, ficha de contacto y notas

api/lead.js     recibe formulario y diagnóstico, califica y avisa
api/leads.js    listado y edición de contactos (requiere sesión)
api/sesion.js   entrada y salida del panel
api/_store.js   almacén de leads sobre Upstash Redis por REST
api/_auth.js    contraseña compartida y cookie firmada

assets/         logo, marca, retratos, fotografías y logos de carriers
vercel.json     cache, cabeceras de seguridad y noindex del panel
robots.txt      indexación
sitemap.xml     mapa del sitio
```

## Cómo circula un lead

1. Alguien envía el formulario de la portada → `POST /api/lead`.
   El contacto queda guardado aunque abandone después.
2. El navegador lo lleva a `/agenda` con sus datos en `sessionStorage`
   —nunca en la URL, porque son datos personales— y responde seis
   preguntas y elige día y hora.
3. `POST /api/lead` otra vez, ahora con las respuestas. **El puntaje se
   calcula en el servidor**, no en el navegador: `api/lead.js` reconstruye
   la suma y clasifica en `PRIORITARIO`, `SEGUIMIENTO` o `NUTRIR`.
4. El lead entra en el almacén. Si ya existía una ficha con ese correo,
   la completa en vez de duplicarla.
5. Sale un correo al equipo con el nivel en el asunto.
6. Aparece en el tablero de `/admin`.

Si el almacén falla, el correo sale igual. Si falla el correo pero el
almacén responde, el lead tampoco se pierde.

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

| Variable | Para qué |
|---|---|
| `RESEND_API_KEY` | clave de Resend |
| `LEAD_TO` | a dónde llegan los leads (acepta varios separados por coma) |
| `LEAD_FROM` | remitente verificado en Resend, p. ej. `VALORA <web@valorawealthadvisors.com>` |
| `KV_REST_API_URL` | almacén de contactos — la crea la integración de Upstash |
| `KV_REST_API_TOKEN` | idem |
| `ADMIN_SECRET` | cadena larga y aleatoria para firmar la sesión |
| `ADMIN_EMAIL` | correo del primer administrador |
| `ADMIN_PASSWORD` | su contraseña inicial — solo sirve para crear esa cuenta |
| `BLOB_READ_WRITE_TOKEN` | archivos de los clientes — la crea la integración de Blob |

**El almacén** se añade desde el panel de Vercel: *Storage → Marketplace →
Upstash for Redis*. Al conectarlo, Vercel inyecta `KV_REST_API_URL` y
`KV_REST_API_TOKEN` solo. No hace falta instalar ninguna librería: el
código habla con la base por REST.

### La sesión de diagnóstico
Desde la ficha de cualquier contacto, «Sesión de diagnóstico» abre la hoja
de perfil financiero que el agente llena durante la cita: ingresos del
hogar, gastos fijos, pagos de deuda y lo que ya tiene. Los números se
calculan en vivo mientras se escriben.

De la hoja salen cuatro cifras y tres semáforos:

| Sale | Cómo se calcula |
|---|---|
| Capacidad de ahorro | ingresos − gastos fijos − pagos de deuda |
| Prima sugerida | la mitad del excedente, con techo del 15% del ingreso |
| Cobertura a cubrir | saldo de deudas + diez años de ingreso del titular − cobertura actual |
| Tasa de ahorro | verde ≥15%, ámbar ≥5% |
| Carga de deuda | verde ≤20%, ámbar ≤36% |
| Colchón de emergencia | verde ≥6 meses, ámbar ≥3 |

Son reglas de referencia del oficio, no doctrina: si el equipo trabaja con
otros umbrales o con otra fórmula de cobertura, se cambian en `calcular()`
dentro de `admin.js`. **Es una hoja de trabajo interna para un agente
licenciado, no un cálculo que se le entregue al cliente como asesoría.**

**Los archivos** se guardan en Vercel Blob: *Storage → Marketplace → Blob*.

### Cuentas y roles
Cada persona entra con su propio correo y contraseña. Hay dos roles:

- **Administrador** — ve todos los contactos, los reparte entre agentes y
  gestiona el equipo.
- **Agente** — ve únicamente los contactos que tiene asignados. El filtro
  se aplica en el servidor, no en el navegador: aunque manipule la página,
  la API no le devuelve lo que no es suyo.

`ADMIN_EMAIL` y `ADMIN_PASSWORD` solo sirven para **crear la primera
cuenta**: la primera vez que ese correo entra, se guarda como
administrador y a partir de ahí manda el almacén. Desde *Equipo* se dan
de alta los demás. El sistema no permite quedarse sin ningún
administrador activo.

Las contraseñas se guardan con `scrypt` y sal por usuario — nunca en
claro. La sesión es una cookie firmada, `HttpOnly` y `Secure`, de 12 horas.
Para el secreto sirve cualquier cadena larga:

```bash
openssl rand -hex 32
```

Cuando des de alta a alguien, **pásale la contraseña inicial por un canal
seguro**, no por correo. Puede cambiarla desde *Equipo → Mi contraseña*.

### Archivos del cliente
Cada ficha admite archivos de hasta 3 MB — PDF, imágenes, Word, Excel y
texto. **No se enlazan directamente:** la URL del blob nunca sale del
servidor. El panel los pide a `/api/archivos`, que comprueba la sesión y
que el contacto sea tuyo antes de devolver un solo byte. Un agente no
puede abrir los archivos de un contacto que no tiene asignado.

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

### Privacidad — atención antes de publicar
El diagnóstico pregunta la **situación migratoria** y esa respuesta queda
guardada junto al nombre, el teléfono y el correo. Es un dato sensible:

- la política de privacidad tiene que decir qué se recoge, para qué y
  cuánto tiempo se conserva — y todavía no existe
- con los archivos entran documentos financieros y, probablemente,
  identificaciones: hay que acordar qué se admite y qué no
- el acceso al panel debe limitarse a quien realmente lo necesite
- conviene decidir un plazo de borrado para los contactos que no prosperan

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
- **Correo:** el pie enlaza `info@valorawealthadvisors.com`. Hay que confirmar
  que ese buzón existe antes de publicar, o el correo rebotará.

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
