# Calculadora de Baldosas

Programa a medida para presupuestar pisos de goma (baldosas). Permite cargar medidas de un ambiente, elegir patrón y colores, y calcula cantidad de baldosas por color, cajas a comprar, y dibuja un plano del piso.

## Stack

- HTML + CSS + JavaScript vanilla (sin frameworks, sin build)
- Persistencia local con `localStorage`
- Supabase preparado pero desconectado (`js/auth/`)

## Cómo correr

### En la compu (rápido)

Abrir `index.html` en el navegador (doble click). Funciona sin instalar nada.

### Con servidor local (recomendado para probar PWA)

```bash
cd calculadora-baldosas
python3 -m http.server 8080
# → http://localhost:8080
```

### Publicar en internet (Netlify / Vercel)

El repo incluye `netlify.toml` y `vercel.json` en la raíz. La carpeta publicada es `calculadora-baldosas`.

## Estructura

```
calculadora-baldosas/
├── index.html              # App principal
├── manifest.json           # PWA
├── sw.js                   # Service worker (caché offline)
├── css/
│   └── style.css           # Estilos
├── assets/
│   ├── icons/              # Logo e íconos PWA
│   └── images/             # Fotos de tipos de piso
└── js/
    ├── app/
    │   └── main.js         # UI, eventos y navegación
    ├── core/
    │   ├── tile-calc.js    # Cálculo, grilla y canvas
    │   ├── plan-viewer.js  # Zoom/pan del plano
    │   └── photo-measure.js # Medición con foto
    ├── data/
    │   └── storage.js      # localStorage (presupuestos, tema, usuario)
    ├── export/
    │   └── export-excel.js # Exportación CSV/Excel
    └── auth/               # Supabase (no conectado aún)
        ├── auth.js
        ├── supabase-config.js
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

1. Login con Supabase — ver `js/auth/README.md`
2. Sincronizar presupuestos en la nube (reemplazar o extender `js/data/storage.js`)
