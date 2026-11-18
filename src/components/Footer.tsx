import { Link } from 'react-router-dom'
import { Instagram, Mail, MapPin, MessageCircle, Music2 } from 'lucide-react'
import { useSettings } from '@/store/settings'
import { useCatalog } from '@/store/catalog'
import { logos } from '@/config'

export function Footer() {
  const { site } = useSettings()
  const { categories } = useCatalog()
  const year = new Date().getFullYear()
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-ink-950">
      <div className="pointer-events-none absolute -left-32 top-0 h-64 w-64 rounded-full bg-brand/20 blur-[120px]" />
      <div className="container-pm relative py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <img src={logos.secondary} alt="PASION MOTORS" className="h-16 w-auto object-contain" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              Más que una tienda: un punto de encuentro para quienes viven la pasión por los motores.
            </p>
            <p className="mt-4 font-display text-sm uppercase tracking-[0.3em] text-brand">
              {site.tagline}
            </p>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/80">Tienda</h3>
            <ul className="mt-5 space-y-3 text-sm text-white/55">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link to={`/catalogo?cat=${c.id}`} className="transition hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/catalogo" className="transition hover:text-white">
                  Ver todo el catálogo
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/80">
              Información
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-white/55">
              <li>
                <Link to="/nosotros" className="transition hover:text-white">
                  Sobre PASION MOTORS
                </Link>
              </li>
              <li>
                <Link to="/spotting" className="transition hover:text-white">
                  Car Spotting
                </Link>
              </li>
              <li>
                <Link to="/envios" className="transition hover:text-white">
                  Envíos y entregas
                </Link>
              </li>
              <li>
                <Link to="/politicas" className="transition hover:text-white">
                  Políticas y términos
                </Link>
              </li>
              <li>
                <Link to="/politicas#datos" className="transition hover:text-white">
                  Tratamiento de datos
                </Link>
              </li>
              <li>
                <Link to="/contacto" className="transition hover:text-white">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/80">
              Contacto
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-white/55">
              {site.email && (
                <li>
                  <a href={`mailto:${site.email}`} className="flex items-center gap-2.5 transition hover:text-white">
                    <Mail className="h-4 w-4 text-brand" /> {site.email}
                  </a>
                </li>
              )}
              {site.whatsapp && (
                <li>
                  <a
                    href={`https://wa.me/${site.whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 transition hover:text-white"
                  >
                    <MessageCircle className="h-4 w-4 text-brand" /> WhatsApp
                  </a>
                </li>
              )}
              <li>
                <a
                  href={`https://instagram.com/${site.instagram?.replace('@', '') ?? ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 transition hover:text-white"
                >
                  <Instagram className="h-4 w-4 text-brand" /> {site.instagram}
                </a>
              </li>
              <li>
                <span className="flex items-center gap-2.5">
                  <Music2 className="h-4 w-4 text-brand" /> {site.tiktok}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-brand" /> {site.city}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 hairline" />

        <div className="mt-6 flex flex-col items-center justify-between gap-4 text-[11px] uppercase tracking-[0.2em] text-white/35 sm:flex-row">
          <p>
            © {year} {site.name}. Todos los derechos reservados.
          </p>
          <p className="text-center sm:text-right">
            Precios y stock se confirman en la tienda
          </p>
        </div>
      </div>
    </footer>
  )
}
