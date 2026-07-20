# Calculadora de Baldosas

Programa a medida para presupuestar pisos de goma (baldosas). Permite cargar medidas de un ambiente, elegir patrón y colores, y calcula cantidad de baldosas por color, cajas a comprar, y dibuja un plano del piso.

## Stack

- HTML + CSS + JavaScript vanilla (sin frameworks, sin build)
- Persistencia local con `localStorage`
- Supabase preparado pero desconectado (`js/pendiente-login/`)

## Cómo correr

Abrir `index.html` en el navegador (doble click). No requiere instalación ni servidor.

```bash
# Opcional: servidor local para evitar restricciones CORS con archivos
python3 -m http.server 8080
# → http://localhost:8080
```

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
- **Medición**: manual, con foto, o con video
- **Dashboard**: listar, editar, duplicar y borrar presupuestos
- **Backup**: exportar/importar JSON
- **Compartir** por WhatsApp (imagen + texto)
- **Imprimir / PDF** desde el navegador
- **Modo oscuro/claro** con preferencia guardada
- **Responsive** para móvil

## Pendiente (cliente)

1. Login con Supabase — ver `js/pendiente-login/README.md`
2. Hosting (Netlify, etc.)
3. PWA (`manifest.json` + ícono)

## En duda

Sección "Medición del ambiente": el cliente aún no definió si mantener foto/video o solo manual.
