import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  CarFront,
  Gift,
  Heart,
  KeyRound,
  Package,
  Power,
  ShoppingBag,
  Sparkles,
  Sticker,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import type { Product } from '@/types'
import { HeroBackdrop } from '@/components/HeroBackdrop'
import { Marquee } from '@/components/Marquee'
import { PromoMessages } from '@/components/PromoMessages'
import { CarDriveBy } from '@/components/CarDriveBy'
import { GarageGallery } from '@/components/GarageGallery'
import { SpottingTeaser } from '@/components/SpottingTeaser'
import { ShiftSection } from '@/components/ShiftSection'
import { Reveal } from '@/components/Reveal'
import { KineticText } from '@/components/KineticText'
import { MaskImage } from '@/components/MaskImage'
import { Parallax } from '@/components/Parallax'
import { HorizontalShowcase } from '@/components/HorizontalShowcase'
import { SectionHeading } from '@/components/SectionHeading'
import { ProductCard } from '@/components/ProductCard'
import { NewsletterForm } from '@/components/NewsletterForm'
import { IgnitionScreen } from '@/components/IgnitionScreen'
import { CategoryShowcase } from '@/components/CategoryShowcase'
import { ProductSpotlight } from '@/components/ProductSpotlight'
import { SpeedSection } from '@/components/SpeedSection'
import { useCatalog } from '@/store/catalog'
import { useCart } from '@/store/cart'
import { useSettings } from '@/store/settings'
import { formatPrice } from '@/lib/utils'
import { usePrefersReducedMotion, useScrollFrame } from '@/lib/motion'
import { heroRotationOf, pickHeroImage } from '@/lib/hero'
import { resolveImageUrl } from '@/lib/images'
import { logos } from '@/config'

const values = [
  { icon: BadgeCheck, title: 'Calidad', text: 'Piezas seleccionadas.' },
  { icon: Heart, title: 'Pasión', text: 'Cultura del motor.' },
  { icon: Truck, title: 'Envíos', text: 'Cobertura nacional.' },
  { icon: Gift, title: 'Empaque', text: 'Unboxing con identidad.' },
]

const giftIcons: Record<string, LucideIcon> = {
  'gift-bolsa': Package,
  'gift-llavero': KeyRound,
  'gift-sticker-redondo': Sparkles,
  'gift-stickers-cars': CarFront,
  'gift-sticker-lamina': Sticker,
}

const IGNITION_KEY = 'pm-ignition-seen'

function accentLastWord(text: string) {
  const words = text.trim().split(/\s+/)
  if (words.length <= 1) return text
  const last = words.pop()
  return (
    <>
      {words.join(' ')} <span className="text-brand">{last}</span>
    </>
  )
}

export function Home() {
  const { categories, featured, bestSellers, newest, products } = useCatalog()
  const { site, activeGifts } = useSettings()

  // La portada puede rotar por día, por semana o al azar en cada visita.
  // `heroTick` recalcula si la pestaña sigue abierta cuando cambia la fecha.
  const [heroTick, setHeroTick] = useState(0)
  const [heroSeed] = useState(() => Math.random())
  const rotation = heroRotationOf(site)

  useEffect(() => {
    if (rotation !== 'daily' && rotation !== 'weekly') return
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2)
    const timer = setTimeout(
      () => setHeroTick((value) => value + 1),
      Math.max(1000, nextMidnight.getTime() - now.getTime()),
    )
    return () => clearTimeout(timer)
  }, [rotation, heroTick])

  const heroImage = useMemo(
    () => pickHeroImage(site, new Date(), heroSeed),
    [site, heroTick, heroSeed],
  )

  /** Producto con fotografía real para el bloque editorial. */
  const spotlight = useMemo(() => {
    const withImages = products.filter((p) => p.images?.length)
    return (
      withImages.find((p) => p.slug === 'aleron-frente-carro') ??
      withImages[0] ??
      products[0] ??
      null
    )
  }, [products])

  const spotlightId = spotlight?.id

  const featuredList = useMemo(() => {
    const base = featured().length ? featured() : products
    const withoutSpotlight = spotlightId ? base.filter((p) => p.id !== spotlightId) : base
    const alternative = spotlightId ? products.filter((p) => p.id !== spotlightId) : products
    return (withoutSpotlight.length ? withoutSpotlight : alternative).slice(0, 6)
  }, [featured, products, spotlightId])

  const bestSellerList = useMemo(() => {
    const curated = bestSellers()
    if (curated.length) return curated.slice(0, 4)
    const sold = [...products]
      .filter((p) => (p.sold ?? 0) > 0)
      .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
    if (sold.length) return sold.slice(0, 4)
    // Sin ventas registradas mostramos piezas que no estén ya en el carrusel,
    // así la sección siempre existe sin repetir el mismo contenido.
    const shown = new Set(featuredList.map((p) => p.id))
    const rest = products.filter((p) => !shown.has(p.id) && p.id !== spotlightId)
    return (rest.length ? rest : products).slice(0, 4)
  }, [bestSellers, products, featuredList, spotlightId])

  const curatedBestCount = useMemo(() => bestSellers().length, [bestSellers])
  const newList = (newest().length ? newest() : products).slice(0, 4)

  const [ignitionOpen, setIgnitionOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.sessionStorage.getItem(IGNITION_KEY) !== '1'
    } catch {
      return true
    }
  })

  const finishIgnition = () => {
    setIgnitionOpen(false)
    try {
      window.sessionStorage.setItem(IGNITION_KEY, '1')
    } catch {
      /* almacenamiento no disponible */
    }
  }

  const heroRef = useRef<HTMLElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const heroContentRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  useScrollFrame(() => {
    const hero = heroRef.current
    const bg = bgRef.current
    const content = heroContentRef.current
    if (!hero) return
    if (reduced) {
      if (bg) bg.style.transform = ''
      if (content) {
        content.style.transform = ''
        content.style.opacity = '1'
      }
      return
    }
    const vh = window.innerHeight || 1
    const p = Math.min(1, Math.max(0, window.scrollY / vh))
    if (bg) {
      bg.style.transform = `translate3d(0, ${(p * 70).toFixed(1)}px, 0) scale(${(1.05 + p * 0.09).toFixed(3)})`
    }
    if (content) {
      content.style.transform = `translate3d(0, ${(-p * 48).toFixed(1)}px, 0)`
      content.style.opacity = String(Math.max(0, 1 - p * 1.15))
    }
  })

  return (
    <div>
      {ignitionOpen && <IgnitionScreen onDone={finishIgnition} />}

      {/* ================= HERO ================= */}
      <section
        ref={heroRef}
        className="relative flex min-h-[100svh] items-end overflow-hidden pb-16 pt-28 sm:items-center sm:pb-24"
      >
        <div ref={bgRef} className="absolute inset-0 origin-center will-change-transform">
          {heroImage ? (
            <>
              <img
                src={resolveImageUrl(heroImage, 1920)}
                alt={`${site.name} · imagen principal`}
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
                {...({ fetchpriority: 'high' } as Record<string, string>)}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/75 to-ink-950/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink-950/60" />
            </>
          ) : (
            <HeroBackdrop />
          )}
        </div>

        <div ref={heroContentRef} className="container-pm relative z-10 w-full will-change-transform">
          <div className="max-w-5xl">
            <Reveal>
              <span className="eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Cultura automotriz · {site.city}
              </span>
            </Reveal>

            <h1 className="display mt-6 text-[3.3rem] leading-[0.86] sm:text-[5.6rem] lg:text-[7.6rem] xl:text-[8.6rem]">
              <KineticText text="Drive the" as="span" className="block" stagger={0.08} />
              <KineticText
                text="passion"
                as="span"
                className="block text-brand"
                delay={0.16}
                stagger={0.08}
              />
            </h1>

            <Reveal delay={220}>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
                Llevamos la cultura automotriz más allá de la carretera. Descubre accesorios, prendas y
                coleccionables que representan tu estilo y mantienen viva tu pasión por los autos.
              </p>
            </Reveal>

            <Reveal delay={320}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link to="/catalogo" className="btn-primary group">
                  Explorar productos
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to="/nosotros" className="btn-ghost">
                  Nuestra historia
                </Link>
                <button
                  type="button"
                  onClick={() => setIgnitionOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60 transition hover:border-brand/50 hover:text-white"
                >
                  <Power className="h-3.5 w-3.5" /> Encender motor
                </button>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                  Explora
                </span>
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/catalogo?cat=${category.id}`}
                    className="chip hover:border-brand/50"
                  >
                    {category.short}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </Reveal>

            <Reveal delay={480}>
              <div className="mt-12 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-7 sm:grid-cols-4">
                {values.map((v) => (
                  <div key={v.title} className="flex items-start gap-3">
                    <v.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                    <div>
                      <p className="text-sm font-semibold text-white">{v.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-white/45">{v.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        <div className="absolute bottom-7 right-6 z-10 hidden flex-col items-center gap-3 lg:flex">
          <span className="text-[10px] uppercase tracking-[0.4em] text-white/40 [writing-mode:vertical-rl]">
            Desliza
          </span>
          <span className="scroll-line h-16 w-px bg-gradient-to-b from-brand to-transparent" />
          <ArrowDown className="h-4 w-4 text-white/40" />
        </div>
      </section>

      <Marquee
        items={[
          'Camisetas',
          'Accesorios',
          'Coleccionables',
          'Regalos',
          'Comunidad',
          'Drive the passion',
        ]}
      />

      {/* ================= CATEGORÍAS ================= */}
      <CategoryShowcase categories={categories} products={products} />

      {/* ================= FEATURED · HORIZONTAL ================= */}
      <section className="relative border-y border-white/10 bg-ink-950">
        <div className="container-pm pt-20 lg:pt-28">
          <SectionHeading
            eyebrow={site.featuredEyebrow?.trim() || 'Selección'}
            title={accentLastWord(site.featuredTitle?.trim() || 'Piezas destacadas')}
            description={
              site.featuredDescription?.trim() ||
              'Los favoritos de la comunidad. Desliza para recorrer la colección.'
            }
            action={
              <Link to="/catalogo" className="btn-ghost">
                Ver todo el catálogo <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        </div>
        <div className="py-12 lg:py-16">
          <HorizontalShowcase perItem={15}>
            {featuredList.map((p, i) => (
              <FeaturedSlide key={p.id} product={p} index={i} />
            ))}
          </HorizontalShowcase>
        </div>
      </section>

      {/* ================= PRODUCTO DESTACADO ================= */}
      {spotlight && <ProductSpotlight product={spotlight} />}

      {/* ================= BEST SELLERS ================= */}
      {bestSellerList.length > 0 && (
        <section className="border-b border-white/10 bg-ink py-20 lg:py-28">
          <div className="container-pm">
            <SectionHeading
              eyebrow={curatedBestCount > 0 ? 'Los favoritos' : 'Recomendados'}
              title={
                curatedBestCount > 0 ? (
                  <>
                    Los más <span className="text-brand">vendidos</span>
                  </>
                ) : (
                  <>
                    Favoritos de la <span className="text-brand">comunidad</span>
                  </>
                )
              }
              description={
                curatedBestCount > 0
                  ? 'Las piezas que más se están llevando la comunidad PASION MOTORS.'
                  : 'Una selección de piezas para empezar o ampliar tu garage.'
              }
              action={
                <Link to="/catalogo" className="btn-ghost">
                  Ver catálogo <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
              {bestSellerList.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================= NEW ================= */}
      <section className="container-pm py-20 lg:py-28">
        <SectionHeading
          eyebrow="Novedades"
          title={
            <>
              Recién <span className="text-brand">llegados</span>
            </>
          }
          description="Lo nuevo en la tienda y recomendaciones para empezar tu colección."
          action={
            <Link to="/catalogo" className="btn-ghost">
              Ver novedades <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
          {newList.map((p, i) => (
            <Reveal key={p.id} delay={i * 70}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= PROMOCIONES ================= */}
      <section className="border-y border-white/10 bg-ink-950 py-14 lg:py-16">
        <div className="container-pm">
          <Reveal>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <span className="eyebrow">Beneficios de la casa</span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                Envíos en Colombia
              </span>
            </div>
          </Reveal>
          <PromoMessages />
        </div>
      </section>

      {/* ================= MANIFESTO ================= */}
      <section className="relative overflow-hidden bg-ink py-24 lg:py-36">
        <div className="pointer-events-none absolute -right-20 top-10 h-80 w-80 rounded-full bg-brand/10 blur-[140px]" />
        <div className="container-pm relative">
          <Reveal>
            <span className="eyebrow">Manifiesto</span>
          </Reveal>
          <h2 className="display mt-8 text-[2rem] leading-[1.02] sm:text-[3.4rem] lg:text-[4.6rem]">
            <KineticText text="No vendemos productos." as="span" className="block" stagger={0.05} />
            <KineticText
              text="Compartimos una pasión."
              as="span"
              className="block text-brand"
              delay={0.18}
              stagger={0.05}
            />
          </h2>

          <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <Reveal>
              <p className="text-lg leading-relaxed text-white/70 sm:text-xl">
                Cada pieza está inspirada en esa emoción que despierta un automóvil: la mirada que se
                queda fija al ver el auto de tus sueños, la adrenalina de escuchar un motor y la
                admiración por cada detalle. En PASION MOTORS celebramos a quienes encuentran en los
                autos mucho más que máquinas: una pasión que los inspira, define su estilo y los
                acompaña dentro y fuera de la carretera.
              </p>
            </Reveal>
            <Reveal delay={140} className="grid gap-6 sm:grid-cols-3 lg:mt-2">
              {categories.map((c) => (
                <div key={c.id} className="border-t border-white/10 pt-4">
                  <p className="font-display text-lg uppercase tracking-tight text-white">{c.short}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/45">{c.description}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= TACÓMETRO / VELOCIDAD ================= */}
      <SpeedSection />

      {/* ================= GARAGE ================= */}
      <GarageGallery />

      {/* ================= CAR SPOTTING ================= */}
      <SpottingTeaser />

      {/* ================= DRIVE-BY ================= */}
      <CarDriveBy />

      {/* ================= SHIFT · NEGRO → BLANCO ================= */}
      <ShiftSection className="py-24 lg:py-36">
        <div className="container-pm">
          <span className="eyebrow">PASION MOTORS</span>
          <h2 className="display mt-6 max-w-4xl text-[2.1rem] leading-[1.03] sm:text-5xl lg:text-[4.4rem]">
            <KineticText text="Donde termina la carretera," as="span" className="block" stagger={0.05} />
            <KineticText
              text="empieza la pasión."
              as="span"
              className="block text-brand"
              delay={0.16}
              stagger={0.05}
            />
          </h2>
          <p className="mt-8 max-w-2xl text-base leading-relaxed opacity-70 sm:text-lg">
            Hay autos que te hacen detener la mirada, motores que te erizan la piel y sueños que algún
            día quieres conducir. En PASION MOTORS llevamos esa emoción más allá del volante, con
            productos que representan tu estilo y celebran aquello que nos une: una pasión que no
            necesita explicación, solo sentirse.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/catalogo" className="btn-primary">
              Explorar productos
            </Link>
            <Link
              to="/nosotros"
              className="btn border border-current text-current transition hover:opacity-70"
            >
              Nuestra historia
            </Link>
          </div>
        </div>
      </ShiftSection>

      {/* ================= PHILOSOPHY ================= */}
      <section className="relative overflow-hidden bg-white text-ink">
        <div className="container-pm grid items-center gap-14 py-20 lg:grid-cols-2 lg:py-32">
          <Reveal>
            <span className="eyebrow text-brand-600">Nuestra filosofía</span>
            <h2 className="display mt-5 text-3xl text-ink sm:text-4xl lg:text-5xl">
              Pasión, confianza,
              <br />
              <span className="text-brand">calidad y comunidad.</span>
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-ink/65">
              PASION MOTORS nace de una comunidad que entiende los autos como identidad. Cada producto
              está pensado para que expreses lo que sientes cuando escuchas un motor.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink/65">
              Construimos una marca que respira cultura automotriz, con calidad, personalidad y una
              comunidad que te respalda.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/nosotros" className="btn-dark">
                Conocer la marca
              </Link>
              <Link
                to="/catalogo"
                className="btn border border-ink/15 text-ink hover:bg-ink hover:text-white"
              >
                Ver productos
              </Link>
            </div>
          </Reveal>

          <Parallax speed={0.08} className="relative">
            <div className="relative mx-auto max-w-md">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-ink/[0.03]" />
              <div className="relative overflow-hidden rounded-[2rem] border border-ink/10 bg-ink-950 p-8 shadow-card">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/30 blur-[80px]" />
                <img
                  src={logos.secondary}
                  alt="PASION MOTORS"
                  className="relative mx-auto w-64 object-contain drop-shadow-2xl"
                />
                <div className="relative mt-8 grid grid-cols-3 gap-3 text-center">
                  {categories.slice(0, 3).map((c) => (
                    <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">
                        {c.short}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="relative mt-6 text-center font-display text-sm uppercase tracking-[0.35em] text-white/70">
                  Drive the passion
                </p>
              </div>
            </div>
          </Parallax>
        </div>
      </section>

      {/* ================= PACKAGING / REGALOS ================= */}
      {activeGifts.length > 0 && (
        <section className="relative overflow-hidden border-b border-white/10 bg-ink-950">
          <div className="container-pm py-20 lg:py-28">
            <SectionHeading
              eyebrow="La experiencia"
              title={
                <>
                  Un empaque que
                  <br />
                  se siente parte de ti
                </>
              }
              description="Cada pedido llega con la firma de la marca. No es solo lo que compras: es cómo lo recibes."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {activeGifts.map((item, i) => {
                const Icon = giftIcons[item.id] ?? Gift
                return (
                  <Reveal key={item.id} delay={i * 90}>
                    <div className="card-surface group h-full p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-brand/40">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="mt-5 text-lg font-semibold text-white">{item.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-white/55">{item.description}</p>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================= COMMUNITY ================= */}
      <section className="relative overflow-hidden bg-brand text-white">
        <div className="absolute inset-0 bg-ink-950/10" />
        <div className="absolute -left-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-white/25 blur-[120px]" />
        <div className="container-pm relative grid items-center gap-10 py-16 lg:grid-cols-[1.4fr_1fr] lg:py-24">
          <Reveal>
            <h2 className="display text-[2.2rem] leading-[0.95] sm:text-5xl lg:text-6xl">
              <KineticText text="Únete a la comunidad" as="span" className="block" stagger={0.05} />
              <KineticText
                text="PASION MOTORS"
                as="span"
                className="block text-ink"
                delay={0.14}
                stagger={0.05}
              />
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/85">
              Déjanos tu correo y entérate primero de nuevos lanzamientos, colecciones y experiencias
              para verdaderos apasionados.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <NewsletterForm />
          </Reveal>
        </div>
        <div className="relative border-t border-white/20 py-4">
          <div className="flex min-w-full shrink-0">
            <ul className="marquee-rtl flex min-w-full shrink-0 items-center">
              {Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="flex items-center">
                  <span className="px-8 font-display text-lg uppercase tracking-[0.2em] text-ink/80">
                    Drive the passion
                  </span>
                  <span className="h-1.5 w-1.5 rotate-45 bg-white/70" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function FeaturedSlide({ product, index }: { product: Product; index: number }) {
  const { addItem } = useCart()
  const price = formatPrice(product.price)
  return (
    <article className="group relative w-[80vw] shrink-0 sm:w-[46vw] lg:w-[32vw] lg:max-w-md">
      <Link to={`/producto/${product.slug}`} className="block" data-cursor>
        <MaskImage
          src={product.images?.[0]}
          alt={product.name}
          driveWidth={1000}
          className="aspect-[3/4] w-full rounded-[1.6rem] border border-white/10"
          imgClassName="transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
          label={product.name}
          note="Foto pendiente"
          parallax={0.12}
        />
        <div className="pointer-events-none absolute inset-0 rounded-[1.6rem] bg-gradient-to-t from-ink-950/85 via-transparent to-transparent" />
        <span className="absolute left-5 top-5 font-display text-4xl text-white/25">
          {String(index + 1).padStart(2, '0')}
        </span>
        {product.isNew && (
          <span className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
            Nuevo
          </span>
        )}
      </Link>
      <div className="pointer-events-none absolute inset-x-5 bottom-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">
          {product.tagline ?? 'PASION MOTORS'}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{product.name}</h3>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white/90">
            {price ?? <span className="text-white/60">Precio por confirmar</span>}
          </span>
          <button
            onClick={() => addItem(product, {}, 1)}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-brand text-white shadow-red transition hover:-translate-y-0.5"
            aria-label={`Añadir ${product.name} al carrito`}
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
