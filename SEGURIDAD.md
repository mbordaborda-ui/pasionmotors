# Refuerzo de seguridad y guardado · PASION MOTORS

Este documento resume **qué se cambió** y, sobre todo, **qué debes ejecutar tú en Supabase**
para que los refuerzos queden activos. El código del proyecto ya está preparado: si falta
algún paso, la app lo avisa («No se guardó en la base de datos») en lugar de fingir que guardó.

---

## 1. Qué se reforzó

### Base de datos

| Antes | Ahora |
| --- | --- |
| Un admin podía borrar pedidos (incluso pagados) y «vaciar pedidos». | Los pedidos **no se pueden borrar** desde la web. Un pedido pendiente se puede **cancelar** (libera stock). Los pagados son registro contable. |
| Los importes/estado del pedido se podían editar desde el navegador. | Un trigger impide cambiar `status`, `total`, `paid_at`, `provider_payment_id`, etc. desde el navegador. Solo el servidor de pagos puede. |
| Cada pedido dejaba poca trazabilidad. | Tabla `order_events`: registra creación, cambios de estado/total y borrados (solo servidor). |
| Guardar un producto hacía varias operaciones sueltas: si fallaba una, quedaba a medias. | RPC transaccional `save_product`: producto + imágenes + variantes + especificaciones en una sola operación (todo o nada). |
| Restablecer/importar catálogo borraba y volvía a insertar producto por producto. | RPC transaccional `replace_catalog`: si un producto falla, se revierte también el borrado. |
| El checkout no tenía límite de intentos ni evidencia de aceptación de términos. | `create_order` exige `termsAccepted` y limita pedidos pendientes por correo/IP. Guarda `terms_accepted_at`, `terms_version` y una huella HMAC de la IP. |
| La confirmación pública (`get_order_confirmation`) mostraba nombre y ciudad a cualquiera con el enlace. | Solo el comprador (sesión/correo), un admin o el servidor ven esos datos. Un enlace filtrado ya no expone PII. |
| Car Spotting aceptaba cualquier archivo. | Storage: solo imágenes (`jpeg/png/webp/avif`) de máximo 5 MB; la tabla `spots` exige URL https y limita longitudes. |
| Borrar un usuario solo borraba su perfil; la cuenta de Auth seguía activa. | Edge Function `admin-delete-user` elimina la cuenta completa de Supabase Auth. |
| Un usuario podía intentar auto-asignarse el rol admin al crear su perfil. | Trigger + policy: solo un admin o el servidor cambian roles. |
| Pagos rechazados por discrepancia solo quedaban en logs. | Tabla `payment_issues` para revisión manual (monto distinto, pedido inexistente, etc.). |

### Frontend

- **Nunca se muestra «Guardado» sin confirmación de la base.** Catálogo, ajustes, categorías,
  garage, usuarios y roles esperan la respuesta real de Supabase.
- Si una escritura falla, aparece un aviso global (`<SaveErrorToast />`) con el motivo real.
- El checkout envía `termsAccepted: true` y `termsVersion` (fecha de las políticas).
- Contraseñas nuevas: mínimo **8 caracteres, con al menos una letra y un número**
  (registro y creación de usuarios desde el panel).
- Cabeceras de seguridad en `netlify.toml` (HSTS, CSP, `X-Frame-Options`, `nosniff`, etc.).

---

## 2. Paso obligatorio: ejecutar el SQL

En **Supabase → SQL Editor → New query**, ejecuta los archivos **en este orden**
(si tu base ya estaba creada, basta con ejecutar el último):

1. `supabase/schema.sql`
2. `supabase/pagos.sql`
3. `supabase/compras-seguras.sql`
4. `supabase/admin.sql`
5. `supabase/actualizar.sql`
6. `supabase/nuevas-funciones.sql`
7. `supabase/pedidos-en-cuenta.sql`
8. `supabase/politicas-legales.sql`
9. `supabase/recuperacion.sql`
10. `supabase/solicitudes-productos.sql`
11. **`supabase/refuerzo-seguridad.sql`** ← el nuevo refuerzo
12. **`supabase/catalogo-inicial.sql`** ← opcional, una sola vez: deja los 23 productos de arranque

> ⚠️ **Importante:** `refuerzo-seguridad.sql` renombra `create_order` a `create_order_base`
> y crea un envoltorio nuevo. Si algún día vuelves a ejecutar `pagos.sql`, **vuelve a ejecutar
> `refuerzo-seguridad.sql` después** o el checkout perderá la validación de términos y el
> límite antiabuso.

El script termina con un resumen:

```
pedidos_pagados | pedidos_sin_terminos | incidencias_pago_abiertas | eventos_auditoria
```

`pedidos_sin_terminos` contará los pedidos antiguos (creados antes de este cambio). Es normal.

### Comprobaciones rápidas (opcionales)

```sql
-- Debe devolver 0 filas: el navegador (anon/authenticated) no puede borrar pedidos.
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'orders'
  and privilege_type = 'DELETE'
  and grantee in ('anon', 'authenticated');

-- Administradores actuales: deben ser solo las cuentas que tú reconozcas.
select id, name, email, role from public.profiles where role = 'admin';

-- Pedidos recientes con evidencia de aceptación de términos.
select id, created_at, terms_accepted_at, terms_version
from public.orders
order by created_at desc
limit 10;
```

---

## 3. Desplegar las Edge Functions

Desde la raíz del proyecto (con Supabase CLI autenticado):

```bash
supabase functions deploy create-checkout
supabase functions deploy payment-webhook
supabase functions deploy send-order-email
supabase functions deploy request-password-reset
supabase functions deploy reset-password
supabase functions deploy email-health
supabase functions deploy admin-delete-user
```

`supabase/config.toml` ya deja estas funciones sin verificación JWT automática porque cada una
valida la petición por dentro. Si las despliegas desde el panel web, desactiva igualmente
«Verify JWT» para: `create-checkout`, `payment-webhook`, `send-order-email`,
`request-password-reset`, `reset-password`, `email-health` y `admin-delete-user`.

### Secretos (Supabase → Edge Functions → Secrets)

| Secreto | Para qué |
| --- | --- |
| `MP_ACCESS_TOKEN` | Cobrar con Mercado Pago (solo servidor). |
| `MP_WEBHOOK_SECRET` | Verificar la firma del webhook **y** generar la huella de IP del checkout. |
| `SITE_URL` | URL pública sin barra final, ej. `https://pasionmotors.com`. |
| `ALLOWED_ORIGINS` | Dominios permitidos para CORS, separados por coma. |
| `RESEND_API_KEY` | Enviar códigos de recuperación, confirmaciones y guías. |
| `RESET_FROM_EMAIL` / `ORDER_FROM_EMAIL` | Remitente verificado en Resend. |
| `PASSWORD_RESET_PEPPER` | Secreto largo y aleatorio para los códigos de recuperación. |
| `TRACKING_URL` | Opcional. Portal de rastreo; por defecto `https://siguetuenvio.interrapidisimo.com`. |
| `SHIPPING_CARRIER` | Opcional. Nombre de la transportadora; por defecto `Interrapidísimo`. |

Nunca pongas `SUPABASE_SERVICE_ROLE_KEY` en el frontend ni en variables `VITE_*`: esas se
publican en el navegador.

### 3.1 Mercado Pago · estado verificado (3 nov 2026)

| Elemento | Valor |
| --- | --- |
| Cuenta | Colombia (MCO), credenciales de producción (`APP_USR-…`) |
| `MP_ACCESS_TOKEN` | Configurado en Supabase (solo servidor) |
| `MP_WEBHOOK_SECRET` | Configurado en Supabase; valida la firma `x-signature` |
| `SITE_URL` / `ALLOWED_ORIGINS` | `https://pasionmotorsapp.netlify.app` ⚠️ (ese dominio responde **404** hoy; cámbialo por el real) |
| Webhook | `https://klhubckgwcgqkglmxpic.supabase.co/functions/v1/payment-webhook` (evento `payment`) |

Comprobaciones hechas sobre el proyecto real:

- La API de Mercado Pago acepta el access token y la cuenta tiene los cobros habilitados.
- Un checkout de prueba creó el pedido y la preferencia en modo real (`live_mode`), con
  `back_urls` y `notification_url` correctas.
- El webhook valida la firma: una firma inválida responde `401`; una válida consulta el pago
  real a la API de Mercado Pago.
- La base ya tiene `order_events` y `payment_issues` (script `refuerzo-seguridad.sql` aplicado).
- CORS: además de los orígenes de `ALLOWED_ORIGINS`, `create-checkout` acepta
  `http://localhost:*`, `http://127.0.0.1:*` y cualquier `*.netlify.app` (incluye previews).
  Para un dominio propio hay que añadirlo a `ALLOWED_ORIGINS`.

> **Local vs. producción:** Mercado Pago rechaza `auto_return` cuando `back_urls` apunta a
> `localhost`; por eso en desarrollo el pago no vuelve automáticamente a la app (el webhook sí
> confirma el pedido). En un dominio público el retorno automático funciona normal.

> Si el checkout responde «No pudimos iniciar el pago…», revisa en este orden: origen en CORS,
> `MP_ACCESS_TOKEN` vigente y que `back_urls` no sea `localhost` con `auto_return`.

> Para cambiar los orígenes permitidos:
> `supabase secrets set SITE_URL="https://tudominio.com" ALLOWED_ORIGINS="https://tudominio.com,https://www.tudominio.com"`

> La **Public Key** (`APP_USR-…`) **no se usa** en este proyecto. El flujo es **Checkout Pro**:
> el servidor crea la preferencia y el navegador solo redirige a `init_point`. No la agregues
> al frontend salvo que migres a Checkout Bricks/Checkout API.

> Si rotas el access token, actualízalo con `supabase secrets set MP_ACCESS_TOKEN="..."`.
> El webhook debe apuntar exactamente a la URL de la tabla anterior y tener el evento `payment`.

---

## 4. Configuración recomendada en el panel de Supabase

1. **Authentication → Providers → Email**
   - Activa **Confirm email** para que nadie use correos ajenos.
   - Revisa la plantilla y el remitente si usas SMTP propio.
2. **Authentication → URL Configuration**
   - `Site URL`: tu dominio real.
   - `Redirect URLs`: `https://tudominio.com/**` (y `http://localhost:5173/**` solo para pruebas).
3. **Database → Backups**
   - Activa copias automáticas. Si tu plan lo permite, **PITR** (point-in-time recovery).
   - Sin backups, un error humano no tiene vuelta atrás.
4. **Storage**
   - Confirma que `spots` y `product-images` existen y que el límite es 5 MB.
   - El script ya limita tipos MIME permitidos.
5. **Mercado Pago**
   - Webhook apuntando a `https://<proyecto>.supabase.co/functions/v1/payment-webhook`.
   - Eventos: `payment`.
   - La clave secreta del webhook debe coincidir con `MP_WEBHOOK_SECRET`.
6. **Revisión periódica**
   - `select * from public.payment_issues where resolved_at is null order by created_at desc;`
   - `select * from public.order_events order by created_at desc limit 50;`

---

## 5. Qué cambia en el día a día

- **Pedidos:** ya no hay papelera ni «Vaciar pedidos». En pedidos `pending` verás
  **Cancelar**, que devuelve el stock. Los pagados se conservan siempre.
- **Pedidos pagados con problema:** si Mercado Pago aprueba un pago pero el pedido no se puede
  confirmar (monto distinto, sin stock), aparecerá una fila en `payment_issues` para que la
  revises y gestiones el reembolso desde Mercado Pago.
- **Catálogo:** si ves el aviso rojo «No se guardó en la base de datos», el cambio **no** se
  aplicó. El mensaje indica la causa (permisos, slug duplicado, SQL pendiente, etc.).
- **Usuarios:** eliminar una cuenta ahora borra también el acceso a Supabase Auth. Es
  irreversible.
- **Checkout:** si alguien intenta crear muchos pedidos pendientes seguidos, verá un aviso de
  «espera unos minutos». Es una protección del inventario, no un cobro.

---

## 6. Catálogo de arranque y envíos

- El catálogo inicial son **23 productos** (8 camisetas, 12 accesorios y 3 coleccionables).
  `supabase/catalogo-inicial.sql` los crea/actualiza y elimina cualquier otro producto; es un
  script **de una sola vez**. Si más adelante agregas productos desde el panel, no lo vuelvas a
  ejecutar porque borraría los nuevos.
- `src/data/catalog.json` contiene esos mismos 23 productos: es lo que usa el botón
  **Restablecer catálogo** del panel. Ojo: restablecer deja las ventas acumuladas (`sold`) en 0.
- Los envíos se hacen con **Interrapidísimo**. Al guardar el número de guía en Admin → Pedidos:
  1. se guarda la guía, la transportadora y el enlace `https://siguetuenvio.interrapidisimo.com`;
  2. se envía el correo al cliente (solo si el pedido está **pagado** y tiene guía);
  3. el cliente ve la guía y el enlace en su cuenta y en `/envios`.
- Para usar otro portal de rastreo basta con cambiar el enlace en el pedido o definir el secreto
  `TRACKING_URL` en Supabase.

---

## 7. Notas legales (Colombia)

- La aceptación de términos y de la política de tratamiento de datos queda registrada por
  pedido (`terms_accepted_at`, `terms_version`) y es visible en Admin → Pedidos.
- La confirmación pública ya no expone nombre, ciudad ni otros datos personales.
- Conserva los pedidos pagados: son soporte de garantía, retracto, facturación y eventuales
  reclamaciones ante la SIC.
- Si cambias las políticas en `/politicas`, actualiza **Admin → Ajustes → Última actualización
  de políticas**. Esa fecha es la versión que quedará guardada en los pedidos nuevos.
- Para tratamiento de datos personales, designa un responsable y un canal de atención
  (hoy: el correo configurado en Ajustes) y atiende consultas/rectificaciones dentro de los
  plazos de la Ley 1581 de 2012.

---

## 8. Pendientes que dependen de una decisión de negocio

1. **Envío:** hoy el checkout cobra solo el subtotal y el envío se coordina aparte. Si quieres
   cobrarlo en línea, hay que definir tarifas y añadirlo al total del servidor.
2. **Car Spotting:** permite publicar sin sesión iniciada (solo se limitan tipo/tamaño). Si
   quieres evitar spam, se puede exigir sesión y moderación previa.
