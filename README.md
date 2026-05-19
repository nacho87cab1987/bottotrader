# EDGE Crypto System — v2.0 con Paper Trader

Sistema completo de análisis técnico para cripto con:
- ✅ Multi-timeframe (Swing 4H/1D/1W + Intraday 15M/1H/4H)
- ✅ Detección automática de soportes, resistencias y Fibonacci
- ✅ Alertas a WhatsApp + Telegram
- ✅ **Paper trader automatizado** (simulación con datos reales)
- ✅ Persistencia con Upstash Redis (KV)
- ✅ Cron job vía cron-job.org

## Cómo deployarlo (paso a paso)

### 1. Crear repo nuevo en GitHub

1. github.com → New repository
2. Nombre: `edge-crypto-system` (o el que quieras)
3. Private → Create
4. **NO** marques "Add README"

### 2. Subir el código

**Opción A — Desde la web:**
1. En el repo vacío, click "uploading an existing file"
2. Arrastrá TODA esta carpeta (descomprimida) al área de drop
3. Espera que cargue (puede tardar 1-2 min con tantos archivos)
4. Commit changes

**Opción B — Desde terminal (más rápido):**
```bash
cd /ruta/a/edge-system-complete
git init
git add .
git commit -m "version inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/edge-crypto-system.git
git push -u origin main
```

### 3. Conectar a Vercel

1. vercel.com → Add New → Project
2. Importá el repo `edge-crypto-system`
3. **NO hagas Deploy aún**, primero agregá las variables de entorno

### 4. Variables de entorno en Vercel

Antes de deployar, en la pantalla de Vercel agregá:

```
WHATSAPP_PHONE=+541155555555
WHATSAPP_API_KEY=tu_api_key_callmebot
TELEGRAM_BOT_TOKEN=tu_token_botfather
TELEGRAM_CHAT_ID=tu_chat_id
CRON_SECRET=cualquier_string_random_largo
```

`KV_REST_API_URL` y `KV_REST_API_TOKEN` se agregarán automáticamente cuando conectes Upstash en el paso 6.

### 5. Deploy

Click "Deploy". Esperá 1-3 min hasta que termine con tilde verde ✓.

### 6. Conectar Upstash Redis (persistencia)

En tu proyecto Vercel:
1. Pestaña Storage → Marketplace
2. Buscá Upstash → Add Integration
3. Tipo: Redis
4. Plan: Free
5. Conectalo al proyecto `edge-crypto-system`
6. Las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN` se agregan solas

### 7. Redeploy

Después de conectar Upstash:
- Pestaña Deployments
- 3 puntos del último deploy → Redeploy

### 8. Configurar cron externo

cron-job.org → Crear cuenta → Create cronjob:
- **URL**: `https://TU-URL-VERCEL.vercel.app/api/cron`
- **Schedule**: Every 5 minutes
- **Headers** → Add header:
  - Name: `Authorization`
  - Value: `Bearer TU_CRON_SECRET`

## Páginas disponibles

- `/` — Analyzer (chart + multi-TF + niveles)
- `/settings` — Watchlist + canales de alerta + cron manual
- `/paper` — Dashboard del paper trader (balance, posiciones, P&L)

## Paper Trader

Balance inicial: $1000 virtuales
Risk per trade: 2%
Stops: en soporte/resistencia detectados
Modos: Swing + Intraday (cada uno con tracking)

Se ejecuta automáticamente cuando hay setup A+ o A en watchlist.
Andá a `/paper` para ver resultados en tiempo real.

## Advertencia legal

Sistema educativo. NO es asesoría financiera. NO uses dinero real hasta haber validado el sistema en paper trading por al menos 60 días.
