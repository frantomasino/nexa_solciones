# Calculadora de Baldosas

Programa a medida para presupuestar pisos de goma (baldosas). Permite cargar medidas de un ambiente, elegir patrón y colores, y calcula cantidad de baldosas por color, cajas a comprar, y dibuja un plano del piso.

## Stack

- HTML + CSS + JavaScript vanilla (sin frameworks, sin build)
- Persistencia local con `localStorage`
- Supabase preparado pero desconectado (`js/pendiente-login/`)

## Cómo correr

### En la compu (rápido)

Abrir `index.html` en el navegador (doble click). Funciona sin instalar nada.

### Con servidor local (recomendado para probar PWA)

```bash
cd calculadora-baldosas
python3 -m http.server 8080
# → http://localhost:8080
```

### Publicar en internet (Netlify)

El repo incluye `netlify.toml` en la raíz. Pasos:

1. Entrá a [netlify.com](https://www.netlify.com) con tu cuenta (o creá una gratis).
2. **Add new site** → **Import an existing project** → conectá GitHub → elegí `nexa_solciones`.
3. Netlify detecta solo: carpeta `calculadora-baldosas`, sin comando de build.
4. **Deploy site**. Te da un link tipo `https://algo-random.netlify.app`.
5. Abrí ese link en el celular o la compu → tocá **Instalar app** (amarillo arriba).

Con HTTPS la instalación nativa del navegador funciona; con `file://` solo ves las instrucciones manuales.

## Estructura

```
calculadora-baldosas/
├── index.html
├── css/style.css
├── js/
│   ├── core/
│   │   ├── tile-calc.js      # Cálculo y canvas
│   │   └── photo-measure.js  # Medición con foto/video
│   ├── data/storage.js       # localStorage
│   ├── app/main.js           # UI y eventos
│   └── pendiente-login/      # Supabase (no conectado)
└── README.md
```

## Funcionalidades

- **Cálculo de baldosas**: medidas → grilla, repuesto configurable (10% default), cajas
- **Patrones**: sólido, marco+centro, damero, rayas H/V, carril central, personalizado (%)
- **Recálculo en vivo** al cambiar cualquier valor
- **Medición**: manual o con foto
- **Dashboard**: listar, editar, duplicar y borrar presupuestos
- **Backup**: exportar/importar JSON
- **Compartir** por WhatsApp (imagen + texto)
- **Imprimir / PDF** desde el navegador
- **Modo oscuro/claro** con preferencia guardada
- **Responsive** para móvil y escritorio
- **PWA**: instalar en celular/PC (`manifest.json`, service worker, botón Instalar app)

## Pendiente (cliente)

1. Login con Supabase — ver `js/pendiente-login/README.md`
2. Conectar Netlify al repo y compartir el link al equipo
