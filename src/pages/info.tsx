import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ExternalLink,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  Wallet,
} from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { ComboBuilder } from '@/components/ComboBuilder'
import { useSettings } from '@/store/settings'
import { supabase } from '@/lib/supabase'
import { ESTIMATED_SHIPPING, SHIPPING_CARRIER, SHIPPING_TRACKING_URL, trackingUrlFor } from '@/lib/shipping'
import { formatPrice } from '@/lib/utils'
import { logos } from '@/config'

function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-ink-900">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-[120px]" />
      <div className="container-pm relative py-16 lg:py-24">
        <Reveal>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="display mt-4 text-4xl sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">{description}</p>
        </Reveal>
      </div>
    </section>
  )
}

export function Nosotros() {
  return (
    <div className="pt-[68px] lg:pt-20">
      <PageHero
        eyebrow="Nosotros"
        title="Somos cultura automotriz"
        description="PASION MOTORS nace para transformar la pasión por los automóviles en productos, identidad, experiencias y comunidad."
      />
      <div className="container-pm grid gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <Reveal className="space-y-6 text-[15px] leading-relaxed text-white/65">
          <p>
            Creemos que un auto no es solo un medio de transporte: es una declaración de identidad. Por
            eso creamos una marca que acompaña a quienes sienten el motor como parte de su vida.
          </p>
          <p>
            Diseñamos y seleccionamos camisetas, accesorios y coleccionables con una obsesión:
            calidad, personalidad y coherencia con la cultura automotriz. Nada de plantillas genéricas;
            cada pieza tiene intención.
          </p>
          <p>
            Más allá de la tienda, construimos comunidad: un espacio donde compartir la pasión, descubrir
            productos y expresar quién eres a través de lo que eliges.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/catalogo" className="btn-primary">
              Explorar productos
            </Link>
            <Link to="/contacto" className="btn-ghost">
              Hablar con nosotros
            </Link>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-ink-950 p-10">
            <img src={logos.secondary} alt="PASION MOTORS" className="mx-auto w-72 object-contain" />
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                { t: 'Pasión', d: 'El motor como forma de vida.' },
                { t: 'Confianza', d: 'Compra clara y sin sorpresas.' },
                { t: 'Calidad', d: 'Selección pensada para durar.' },
                { t: 'Comunidad', d: 'Perteneces a algo más grande.' },
              ].map((v) => (
                <div key={v.t} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="font-semibold text-white">{v.t}</p>
                  <p className="mt-1 text-xs text-white/50">{v.d}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

export function Envios() {
  const { activePromos } = useSettings()
  const shirtPromo = activePromos.find((p) => p.kind === 'shirt')
  const amountPromo = activePromos.find((p) => p.kind === 'amount' && (p.amount ?? 0) > 0)
  const requisitos = [
    shirtPromo ? 'incluye al menos una camiseta' : null,
    amountPromo ? `supera ${formatPrice(amountPromo.amount)} en productos` : null,
  ]
    .filter(Boolean)
    .join(' o ')

  const items = [
    { icon: Truck, t: 'Cobertura', d: `Enviamos a toda Colombia con ${SHIPPING_CARRIER}. Los tiempos de entrega se confirman al despachar tu pedido.` },
    { icon: Wallet, t: 'Pago del envío', d: `El envío tiene un valor estimado de ${formatPrice(ESTIMATED_SHIPPING)}. Es solo una referencia: el valor final depende del destino y el peso, y se paga contra entrega al recibir el pedido.${requisitos ? ` Si tu compra ${requisitos}, el envío corre por nuestra cuenta.` : ''}` },
    { icon: Package, t: 'Preparación', d: 'Cada pedido se prepara con nuestro empaque de marca y los regalos que elijas durante la compra.' },
    { icon: ShieldCheck, t: 'Seguimiento', d: `Cuando tu pedido salga cargamos el número de guía y el enlace de ${SHIPPING_CARRIER}. Consulta el estado en esta misma página.` },
    { icon: RotateCcw, t: 'Devoluciones', d: 'Consulta la política de cambios y devoluciones para conocer plazos y condiciones.' },
  ]
  return (
    <div className="pt-[68px] lg:pt-20">
      <PageHero
        eyebrow="Envíos"
        title="Envíos y entregas"
        description="Queremos que recibir tu pedido sea tan emocionante como elegirlo. Aquí está la información general de envíos."
      />
      <div className="container-pm grid gap-5 py-16 sm:grid-cols-2 lg:py-24">
        {items.map((it, i) => (
          <Reveal key={it.t} delay={i * 70}>
            <div className="card-surface h-full p-7">
              <it.icon className="h-6 w-6 text-brand" />
              <h3 className="mt-4 text-lg font-semibold text-white">{it.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{it.d}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="container-pm pb-16 lg:pb-24">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal>
            <span className="eyebrow">Rastreo</span>
            <h2 className="display mt-3 text-3xl sm:text-4xl">
              Consulta tu <span className="text-brand">envío</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
              Ingresa tu número de guía o el número de pedido. Si ya te enviamos, verás el estado y
              el enlace para seguir el recorrido en {SHIPPING_CARRIER}.
            </p>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-white/40">
              ¿Aún no tienes tu guía? Revisa tu correo o escríbenos y te ayudamos a ubicar tu pedido.
            </p>
            <a
              href={SHIPPING_TRACKING_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-300 transition hover:text-white"
            >
              Ir al portal de {SHIPPING_CARRIER} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Reveal>
          <Reveal delay={100}>
            <TrackingLookup />
          </Reveal>
        </div>
      </div>
    </div>
  )
}

interface TrackResult {
  found?: boolean
  id?: string
  status?: string
  count?: number
  created_at?: string
  tracking_number?: string | null
  tracking_carrier?: string | null
  tracking_url?: string | null
  shipped_at?: string | null
}

const TRACK_STATUS: Record<string, string> = {
  pending: 'Pendiente de pago',
  paid: 'Pagado · preparando envío',
  failed: 'Pago fallido',
  refunded: 'Reembolsado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
}

function TrackingLookup() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<TrackResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setResult(null)
    const { data, error: rpcError } = await supabase.rpc('track_order', { p_query: q })
    setLoading(false)
    if (rpcError) {
      setError('No pudimos consultar el envío. Verifica el número e inténtalo de nuevo.')
      return
    }
    if (!data) {
      setError('No encontramos un pedido con ese número de guía o de pedido.')
      return
    }
    setResult(data as TrackResult)
  }

  return (
    <div className="card-surface p-6 lg:p-8">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="field"
          placeholder="Número de guía o de pedido"
          aria-label="Número de guía o de pedido"
        />
        <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Consultar
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-xs leading-relaxed text-amber-100/85">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Pedido encontrado
          </p>
          <p className="mt-3 text-sm text-white">
            Estado:{' '}
            <span className="font-semibold">
              {TRACK_STATUS[result.status ?? ''] ?? result.status ?? 'En proceso'}
            </span>
          </p>
          <p className="mt-1 text-xs text-white/55">
            Pedido <span className="font-mono text-white/80">{result.id?.slice(0, 8)}</span>
            {result.count ? ` · ${result.count} ${result.count === 1 ? 'artículo' : 'artículos'}` : ''}
          </p>

          {result.tracking_number ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-ink-950/40 p-4">
              <p className="flex items-center gap-2 text-xs text-white/60">
                <Truck className="h-4 w-4 text-brand" />
                Guía <strong className="font-mono text-white">{result.tracking_number}</strong>
                {` · ${result.tracking_carrier?.trim() || SHIPPING_CARRIER}`}
              </p>
              <a
                href={trackingUrlFor(result.tracking_url)}
                target="_blank"
                rel="noreferrer"
                className="btn-primary mt-3 w-full !py-2.5 !text-[12px]"
              >
                Consultar en {SHIPPING_CARRIER} <ExternalLink className="h-4 w-4" />
              </a>
              <p className="mt-2 text-[11px] text-white/40">
                Si el portal te pide un dato adicional, usa el número de guía que aparece arriba.
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-white/10 bg-ink-950/40 p-4 text-xs leading-relaxed text-white/50">
              Tu pedido está registrado. Cuando salga, aparecerá aquí el número de guía y el enlace de
              seguimiento.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function Politicas() {
  const { site } = useSettings()
  const email = site.email?.trim()
  const whatsapp = site.whatsapp?.trim()
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`
    : undefined
  const updatedAt = formatLegalDate(site.legalUpdatedAt)

  const sections = [
    {
      id: 'atencion',
      title: '1. Atención al cliente y reclamaciones',
      content: (
        <>
          <p>
            En PASIÓN MOTORS estamos comprometidos con ofrecer una atención clara, respetuosa y
            oportuna. Puedes comunicarte con nosotros para resolver dudas sobre productos, pedidos,
            pagos, entregas, cambios, garantías o cualquier inconveniente relacionado con tu compra.
          </p>
          <p className="font-semibold text-white/85">Canales de atención:</p>
          <ul className="list-inside list-disc space-y-1">
            {email && (
              <li>
                Correo electrónico:{' '}
                <a href={`mailto:${email}`} className="text-brand-300 underline underline-offset-4">
                  {email}
                </a>
              </li>
            )}
            {whatsappHref && (
              <li>
                WhatsApp:{' '}
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-300 underline underline-offset-4"
                >
                  {whatsapp}
                </a>
              </li>
            )}
            {!email && !whatsappHref && (
              <li>
                Instagram:{' '}
                <a
                  href={`https://instagram.com/${(site.instagram ?? '@pasionmotors').replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-300 underline underline-offset-4"
                >
                  {site.instagram ?? '@pasionmotors'}
                </a>
              </li>
            )}
          </ul>
          <p>
            Para agilizar tu solicitud, te recomendamos indicar el número de pedido, la fecha de compra
            y una descripción del caso.
          </p>
          <p>
            Atenderemos tus solicitudes y reclamaciones conforme a los plazos y procedimientos
            establecidos por la legislación colombiana. Si consideras que tus derechos como consumidor
            han sido vulnerados, podrás acudir a las autoridades competentes, como la Superintendencia
            de Industria y Comercio.
          </p>
        </>
      ),
    },
    {
      id: 'garantia',
      title: '2. Política de garantía legal',
      content: (
        <>
          <p>
            En PASIÓN MOTORS ofrecemos productos sujetos a las condiciones de calidad, idoneidad y
            seguridad exigidas por la legislación colombiana.
          </p>
          <p>
            Si recibes un producto defectuoso o que no cumple con las características ofrecidas, puedes
            presentar una reclamación por garantía legal a través de nuestros canales de atención.
          </p>
          <p>
            Para gestionar la solicitud, podremos pedirte el número de pedido, una descripción del
            inconveniente y fotografías o videos que ayuden a identificarlo, cuando corresponda.
          </p>
          <p>
            La solución se determinará conforme a la ley y a las características del caso. Según
            corresponda, podrá incluir reparación gratuita, cambio del producto o devolución del
            dinero.
          </p>
          <p>
            La garantía no cubre daños ocasionados por uso indebido, accidentes, modificaciones no
            autorizadas o desgaste normal cuando se demuestre que estas circunstancias causaron el daño
            y conforme a las reglas legales aplicables.
          </p>
          <p>
            Los productos en promoción o con descuento también conservan los derechos de garantía que
            les correspondan legalmente.
          </p>
        </>
      ),
    },
    {
      id: 'envios',
      title: '3. Política de envíos y entregas',
      content: (
        <>
          <p>
            PASIÓN MOTORS realiza envíos a nivel nacional dentro de Colombia, sujetos a la cobertura de
            las empresas transportadoras.
          </p>
          <p>
            <strong className="text-white/85">Disponibilidad:</strong> los pedidos están sujetos a la
            disponibilidad confirmada del producto.
          </p>
          <p>
            <strong className="text-white/85">Costos de envío:</strong> el valor del envío se informará
            antes de confirmar la compra.
          </p>
          <p>
            <strong className="text-white/85">Tiempos de entrega:</strong> el plazo estimado se
            comunicará antes de finalizar el pedido, de acuerdo con el destino y el servicio de
            transporte disponible.
          </p>
          <p>
            <strong className="text-white/85">Seguimiento:</strong> cuando sea posible, proporcionaremos
            información para consultar el estado del envío.
          </p>
          <p>
            Es responsabilidad del comprador proporcionar una dirección completa y correcta. Si ocurre
            una novedad con la entrega, como retrasos, pérdida o daños durante el transporte, puedes
            comunicarte con nosotros para gestionar la solución correspondiente.
          </p>
          <p>
            PASIÓN MOTORS atenderá sus obligaciones legales relacionadas con la entrega y no utilizará
            esta política para excluir los derechos del consumidor.
          </p>
        </>
      ),
    },
    {
      id: 'cambios',
      title: '4. Política de cambios voluntarios',
      content: (
        <>
          <p>
            En PASIÓN MOTORS queremos que disfrutes tu compra. Por eso, puedes solicitar un cambio
            voluntario dentro de los <strong className="text-white/85">5 días calendario siguientes a
            la entrega del producto</strong>, sujeto a disponibilidad y a las condiciones de esta
            política.
          </p>
          <p>
            El producto deberá estar sin uso, en buen estado y conservar sus etiquetas, accesorios y
            empaque original, cuando corresponda.
          </p>
          <p>
            Los cambios estarán sujetos a la disponibilidad de la referencia solicitada. Si existe una
            diferencia de precio, esta se informará antes de confirmar el cambio.
          </p>
          <p>
            Los gastos de transporte derivados de cambios solicitados por preferencia personal podrán
            ser asumidos por el cliente, siempre que se informen previamente y que ello no contradiga
            una obligación legal.
          </p>
          <p>
            Esta política aplica únicamente a cambios voluntarios y no limita la garantía legal, el
            derecho de retracto ni otros derechos reconocidos al consumidor por la legislación
            colombiana.
          </p>
          <p>Para iniciar una solicitud, comunícate con nuestros canales oficiales de atención.</p>
        </>
      ),
    },
    {
      id: 'retracto',
      title: '5. Derecho de retracto',
      content: (
        <>
          <p>
            Cuando la compra se realice por medios a distancia y el consumidor ejerza el derecho de
            retracto dentro de los cinco (5) días hábiles siguientes a la entrega, se aplicarán las
            condiciones previstas en la Ley 1480 de 2011 y demás normativa aplicable.
          </p>
          <p>
            Para ejercerlo, el producto debe estar sin uso, en buen estado y conservar sus etiquetas,
            accesorios y empaque original, cuando corresponda. El cliente deberá informar su decisión
            por los canales oficiales de atención.
          </p>
          <p>
            La devolución del dinero se realizará conforme a la ley y a los medios de pago utilizados.
            Los costos de transporte asociados al retracto se asumirán en los términos permitidos por la
            ley. Cuando el producto presente una falla o no corresponda a lo ofrecido, no se cobrarán
            costos adicionales al consumidor.
          </p>
          <p>
            El derecho de retracto no aplica a los productos respecto de los cuales la ley prevea
            excepciones.
          </p>
        </>
      ),
    },
    {
      id: 'terminos',
      title: '6. Términos y condiciones de compra',
      content: (
        <>
          <h3 className="font-semibold text-white/90">Productos y disponibilidad</h3>
          <p>
            PASIÓN MOTORS comercializa productos relacionados con la cultura automotriz, incluyendo
            accesorios, prendas de vestir, miniaturas y artículos coleccionables.
          </p>
          <p>
            Las características, imágenes, referencias, precios y disponibilidad se informarán en las
            respectivas publicaciones. Las imágenes ilustrativas no sustituyen la descripción específica
            del producto.
          </p>

          <h3 className="mt-5 font-semibold text-white/90">Precios y pagos</h3>
          <p>
            Los precios y las condiciones de las promociones se mostrarán de forma clara. Antes de
            confirmar el pedido, el cliente podrá revisar el valor de los productos, los costos de envío
            y los demás cargos aplicables.
          </p>
          <p>
            Los medios de pago disponibles se indicarán durante el proceso de compra. La tramitación del
            pedido estará sujeta a la confirmación del pago cuando corresponda. Los pagos en línea se
            procesan mediante Mercado Pago; PASIÓN MOTORS no almacena datos de tarjetas.
          </p>

          <h3 className="mt-5 font-semibold text-white/90">Confirmación del pedido</h3>
          <p>
            Antes de finalizar la compra, el cliente debe verificar las referencias, cantidades,
            dirección de entrega y valor total. Si se presenta un inconveniente que impida cumplir el
            pedido, PASIÓN MOTORS informará al comprador y aplicará la solución legal correspondiente.
          </p>

          <h3 className="mt-5 font-semibold text-white/90">Entregas</h3>
          <p>
            Las condiciones, los costos y los plazos estimados de entrega se informarán antes de
            confirmar la compra. Cualquier novedad se gestionará de acuerdo con las obligaciones legales
            aplicables.
          </p>

          <h3 className="mt-5 font-semibold text-white/90">Cambios, retracto y garantía</h3>
          <p>
            Los cambios voluntarios se regirán por la política de cambios publicada en la tienda. El
            derecho de retracto se reconocerá cuando resulte legalmente aplicable, y las reclamaciones
            por garantía se atenderán conforme a la legislación colombiana.
          </p>
          <p>
            Ninguna disposición de estos términos limita los derechos irrenunciables del consumidor.
          </p>
        </>
      ),
    },
    {
      id: 'datos',
      title: '7. Política de tratamiento de datos personales',
      content: (
        <>
          <p>
            Los datos personales que recopilamos —como nombre, correo electrónico, teléfono, ciudad y
            dirección de entrega— se utilizan para gestionar pedidos, pagos, envíos, garantías,
            solicitudes de productos agotados y comunicaciones relacionadas con la compra.
          </p>
          <p>
            El tratamiento se realiza conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás
            normativa colombiana aplicable. Al proporcionar tus datos, autorizas su uso para las
            finalidades descritas en esta política.
          </p>
          <p>
            Podrás conocer, actualizar, rectificar y suprimir tus datos, así como revocar la
            autorización, escribiendo a{' '}
            {email ? (
              <a href={`mailto:${email}`} className="text-brand-300 underline underline-offset-4">
                {email}
              </a>
            ) : (
              <strong className="text-white/80">
                nuestro Instagram {site.instagram ?? '@pasionmotors'}
              </strong>
            )}{' '}
            con el asunto “Datos personales”. También puedes solicitar la eliminación de tu suscripción
            al boletín por ese mismo canal.
          </p>
          <p>
            No compartimos tus datos con terceros para fines publicitarios ajenos a PASIÓN MOTORS. Podrán
            intervenir proveedores tecnológicos y pasarelas de pago necesarios para operar la tienda,
            bajo obligaciones de confidencialidad y seguridad.
          </p>
          <p>
            El sitio puede usar almacenamiento local del navegador para conservar el carrito de compras.
            No utilizamos esa información para identificar personalmente al usuario.
          </p>
        </>
      ),
    },
    {
      id: 'propiedad',
      title: '8. Propiedad intelectual',
      content: (
        <p>
          Las marcas, logos, fotografías, textos y demás contenidos de PASIÓN MOTORS pertenecen a sus
          respectivos titulares. Las marcas y logos de terceros, como fabricantes de vehículos, se usan
          únicamente para describir productos coleccionables y pertenecen a sus respectivos dueños. No
          se autoriza su uso sin permiso.
        </p>
      ),
    },
    {
      id: 'legislacion',
      title: '9. Legislación aplicable y actualizaciones',
      content: (
        <>
          <p>
            Las compras realizadas en PASIÓN MOTORS se rigen por la legislación colombiana. Las
            solicitudes, reclamaciones y controversias serán atendidas conforme a las disposiciones
            aplicables y por las autoridades competentes.
          </p>
          <p>
            PASIÓN MOTORS podrá actualizar estas políticas para reflejar cambios legales u operativos.
            La versión vigente será la publicada en esta página, indicando su fecha de última
            actualización.
          </p>
        </>
      ),
    },
  ]

  return (
    <div className="pt-[68px] lg:pt-20">
      <PageHero
        eyebrow="Legal"
        title="Políticas y condiciones"
        description="Transparencia para que compres con confianza. Aquí encuentras las condiciones de servicio, compra, envíos, garantías y tratamiento de datos."
      />

      <div className="container-pm grid gap-10 py-16 lg:grid-cols-[250px_1fr] lg:gap-14 lg:py-24">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="card-surface p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
              Contenido
            </p>
            <nav className="mt-3 space-y-1.5">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-xs leading-relaxed text-white/55 transition hover:text-white"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </div>

          <div className="card-surface mt-4 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
              Contacto
            </p>
            {email && (
              <a
                href={`mailto:${email}`}
                className="mt-3 flex items-center gap-2 text-xs text-white/70 transition hover:text-white"
              >
                <Mail className="h-4 w-4 shrink-0 text-brand" /> {email}
              </a>
            )}
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-2 text-xs text-white/70 transition hover:text-white"
              >
                <MessageCircle className="h-4 w-4 shrink-0 text-brand" /> WhatsApp
              </a>
            )}
            <p className="mt-4 text-[11px] leading-relaxed text-white/35">
              Última actualización: {updatedAt}
            </p>
          </div>
        </aside>

        <article className="min-w-0">
          <div className="space-y-8">
            {sections.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i * 40, 200)}>
                <section
                  id={s.id}
                  className="scroll-mt-28 border-b border-white/10 pb-8 last:border-0 last:pb-0"
                >
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">{s.title}</h2>
                  <div className="mt-4 space-y-3 text-sm leading-relaxed text-white/60">
                    {s.content}
                  </div>
                </section>
              </Reveal>
            ))}
          </div>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <p className="font-display text-lg uppercase tracking-tight text-white">PASIÓN MOTORS</p>
            <p className="mt-1 text-sm text-white/55">Pasión por los automóviles.</p>
            {(email || whatsapp) && (
              <p className="mt-3 text-xs text-white/45">
                {email ? (
                  <>
                    Correo:{' '}
                    <a href={`mailto:${email}`} className="text-brand-300 hover:text-white">
                      {email}
                    </a>
                  </>
                ) : (
                  <>WhatsApp: {whatsapp}</>
                )}
                {email && whatsapp ? ` · WhatsApp: ${whatsapp}` : ''}
              </p>
            )}
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/30">
              Última actualización: {updatedAt}
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}

function formatLegalDate(value?: string | null): string {
  if (!value) return 'Fecha por confirmar'
  const normalized = value.includes('T') ? value : `${value}T12:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar'
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function Contacto() {
  const { site } = useSettings()
  const channels = [
    site.email && { icon: Mail, label: 'Correo', value: site.email, href: `mailto:${site.email}` },
    site.instagram && {
      icon: Instagram,
      label: 'Instagram',
      value: site.instagram,
      href: `https://instagram.com/${site.instagram.replace('@', '')}`,
    },
    site.whatsapp && {
      icon: MessageCircle,
      label: 'WhatsApp',
      value: 'Escríbenos',
      href: `https://wa.me/${site.whatsapp}`,
    },
    site.tiktok && { icon: Music2, label: 'TikTok', value: site.tiktok, href: undefined },
    site.city && { icon: MapPin, label: 'Ubicación', value: site.city, href: undefined },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href?: string }[]

  return (
    <div className="pt-[68px] lg:pt-20">
      <PageHero
        eyebrow="Contacto"
        title="Hablemos de motores"
        description="¿Tienes una duda, una idea o quieres un producto especial? Estamos a un mensaje de distancia."
      />
      <div className="container-pm grid gap-10 py-16 lg:grid-cols-[1fr_1.2fr] lg:py-24">
        <Reveal>
          <div className="space-y-4">
            {channels.map((c) => (
              <div key={c.label} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                  <c.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/45">{c.label}</p>
                  {c.href ? (
                    <a href={c.href} target="_blank" rel="noreferrer" className="font-medium text-white transition hover:text-brand-300">
                      {c.value}
                    </a>
                  ) : (
                    <p className="font-medium text-white/70">{c.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <ComboBuilder />
        </Reveal>
      </div>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="container-pm flex min-h-[80vh] flex-col items-center justify-center gap-5 pt-24 text-center">
      <p className="font-display text-7xl uppercase tracking-tight text-white sm:text-9xl">
        4<span className="text-brand">0</span>4
      </p>
      <p className="max-w-sm text-sm text-white/55">
        La página que buscas no existe o fue movida. Pero tu próxima pasión te espera en el catálogo.
      </p>
      <Link to="/" className="btn-primary mt-2">
        Volver al inicio
      </Link>
    </div>
  )
}
