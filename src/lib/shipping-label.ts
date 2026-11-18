import type { Order } from '@/types'
import { SHIPPING_SENDER } from '@/lib/shipping'

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function itemLine(item: Order['items'][number]): string {
  const selections = Object.entries(item.selections ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
  const detail = selections ? ` (${selections})` : ''
  return `${item.qty} × ${item.name}${detail}`
}

/**
 * HTML de la guía de envío (100 × 150 mm). Se separa de `openShippingLabel`
 * para poder previsualizarla o reutilizarla sin abrir la ventana de impresión.
 */
export function buildShippingLabelHtml(order: Order): string {
  const customer = order.customer
  const items = order.items.slice(0, 6)
  const extraItems = Math.max(0, order.items.length - items.length)
  const shortId = order.id.slice(0, 8).toUpperCase()

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Guía ${escapeHtml(shortId)} · PASION MOTORS</title>
  <style>
    @page { size: 100mm 150mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; }
    body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .label {
      width: 100mm;
      height: 150mm;
      padding: 5mm;
      display: flex;
      flex-direction: column;
      gap: 2.5mm;
      overflow: hidden;
    }
    .header { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 0.6mm solid #111; padding-bottom: 2mm; }
    .brand { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; }
    .brand span { color: #FF1E2D; }
    .tag { font-size: 6px; letter-spacing: 2px; color: #555; text-transform: uppercase; }
    .doc { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #FF1E2D; }
    .eyebrow { margin: 0 0 0.8mm; font-size: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #777; }
    .section { border: 0.3mm solid #ccc; border-radius: 2mm; padding: 2mm 2.5mm; }
    .name { margin: 0; font-size: 12px; font-weight: 800; line-height: 1.15; }
    .line { margin: 0.6mm 0 0; font-size: 8px; line-height: 1.35; }
    .address { margin: 0; font-size: 11px; font-weight: 700; line-height: 1.25; }
    .city { margin: 0.8mm 0 0; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .items { margin: 0; padding: 0; list-style: none; }
    .items li { font-size: 7.5px; line-height: 1.35; border-bottom: 0.2mm dotted #ddd; padding: 0.4mm 0; }
    .items li:last-child { border-bottom: none; }
    .notes { font-size: 7.5px; line-height: 1.35; }
    .notes-section { background: #f4f4f4; border-color: #999; }
    .notes-clamp {
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .footer { margin-top: auto; border-top: 0.3mm dashed #999; padding-top: 1.5mm; display: flex; justify-content: space-between; gap: 3mm; font-size: 6.5px; color: #555; }
    .sign { border-top: 0.2mm solid #555; width: 45mm; padding-top: 0.8mm; text-align: center; }
    @media print {
      html, body { width: 100mm; height: 150mm; }
      .label { width: 100mm; height: 150mm; }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      <div>
        <div class="brand">PASION <span>MOTORS</span></div>
        <div class="tag">Drive the passion</div>
      </div>
      <div class="doc">Guía de envío</div>
    </div>

    <div class="section">
      <p class="eyebrow">Destinatario</p>
      <p class="name">${escapeHtml(customer.name)}</p>
      <p class="line">CC / Documento: ${escapeHtml(customer.document || '—')}</p>
      <p class="line">Tel: ${escapeHtml(customer.phone)}</p>
      <p class="line">${escapeHtml(customer.email)}</p>
    </div>

    <div class="section">
      <p class="eyebrow">Dirección de entrega</p>
      <p class="address">${escapeHtml(customer.address)}</p>
      <p class="city">${escapeHtml(customer.city)}</p>
    </div>

    <div class="section">
      <p class="eyebrow">Remitente</p>
      <p class="name" style="font-size:10px">${escapeHtml(SHIPPING_SENDER.name)}</p>
      <p class="line">CC / Documento: ${escapeHtml(SHIPPING_SENDER.document)}</p>
      <p class="line">${escapeHtml(SHIPPING_SENDER.address)}</p>
    </div>

    <div class="section">
      <p class="eyebrow">Contenido (${order.count} ${order.count === 1 ? 'artículo' : 'artículos'})</p>
      <ul class="items">
        ${items.map((item) => `<li>${escapeHtml(itemLine(item))}</li>`).join('')}
      </ul>
      ${extraItems > 0 ? `<p class="line">+ ${extraItems} ítem(s) adicional(es)</p>` : ''}
    </div>

    ${customer.notes ? `<div class="section notes-section"><p class="eyebrow">Observaciones del cliente</p><p class="notes notes-clamp">${escapeHtml(customer.notes)}</p></div>` : ''}

    <div class="footer">
      <div class="sign">Recibido por</div>
      <div class="sign">Fecha / hora</div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      window.focus();
      setTimeout(function () { window.print(); }, 250);
    });
    window.addEventListener('afterprint', function () { window.close(); });
  </script>
</body>
</html>`

  return html
}

/**
 * Abre una ventana con la guía lista para imprimir o guardar como PDF.
 * Devuelve false si el navegador bloquea la ventana.
 */
export function openShippingLabel(order: Order): boolean {
  const win = window.open('', '_blank', 'width=460,height=700')
  if (!win) return false
  win.document.open()
  win.document.write(buildShippingLabelHtml(order))
  win.document.close()
  return true
}
