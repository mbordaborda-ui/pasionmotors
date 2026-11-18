import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, Mail, RotateCcw, Save } from 'lucide-react'
import { useSettings } from '@/store/settings'
import { supabase } from '@/lib/supabase'
import { AdminHeroImages } from '@/components/AdminHeroImages'
import { site as defaultSite } from '@/config'
import type { SiteConfig } from '@/types'

interface EmailHealth {
  ready?: boolean
  provider?: 'resend' | 'emailjs' | null
  resend?: boolean
  emailjs?: boolean
  pepper?: boolean
  siteUrl?: boolean
}

export function SettingsPanel() {
  const { site, updateSite, resetSite } = useSettings()
  const [draft, setDraft] = useState<SiteConfig>(site)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [emailHealth, setEmailHealth] = useState<EmailHealth | null>(null)
  const [emailLoading, setEmailLoading] = useState(true)

  const set = (patch: Partial<SiteConfig>) => setDraft((d) => ({ ...d, ...patch }))

  useEffect(() => {
    let active = true
    supabase.functions
      .invoke<EmailHealth>('email-health')
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setEmailHealth(data)
      })
      .finally(() => {
        if (active) setEmailLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const save = async () => {
    if (saving) return
    setSaving(true)
    const res = await updateSite(draft)
    setSaving(false)
    // Solo se anuncia «Guardado» si la base de datos confirmó el cambio.
    if (!res.ok) return
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const reset = async () => {
    if (!confirm('¿Restablecer todos los ajustes del sitio a sus valores originales?')) return
    const res = await resetSite()
    if (!res.ok) return
    setDraft(defaultSite)
  }

  return (
    <div className="space-y-6">
      <div className="card-surface p-6">
        <h3 className="font-display text-lg uppercase tracking-tight">Identidad de la marca</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Nombre">
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className="field" />
          </Field>
          <Field label="Eslogan (tagline)">
            <input value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} className="field" />
          </Field>
          <Field label="Ciudad">
            <input value={draft.city ?? ''} onChange={(e) => set({ city: e.target.value })} className="field" />
          </Field>
          <Field label="Correo de contacto y notificaciones">
            <input value={draft.email ?? ''} onChange={(e) => set({ email: e.target.value })} className="field" />
          </Field>
          <Field label="WhatsApp (solo números, ej 573001112233)">
            <input value={draft.whatsapp ?? ''} onChange={(e) => set({ whatsapp: e.target.value })} className="field" />
          </Field>
          <Field label="Instagram">
            <input value={draft.instagram ?? ''} onChange={(e) => set({ instagram: e.target.value })} className="field" />
          </Field>
          <Field label="TikTok">
            <input value={draft.tiktok ?? ''} onChange={(e) => set({ tiktok: e.target.value })} className="field" />
          </Field>
          <Field label="Envío gratis desde (opcional)">
            <input
              type="number"
              min={0}
              value={draft.freeShippingFrom ?? ''}
              onChange={(e) =>
                set({ freeShippingFrom: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="field"
              placeholder="—"
            />
          </Field>
          <Field label="Compra mínima (0 = sin mínimo)">
            <input
              type="number"
              min={0}
              value={draft.minOrder ?? 0}
              onChange={(e) => set({ minOrder: e.target.value === '' ? 0 : Number(e.target.value) })}
              className="field"
              placeholder="24900"
            />
          </Field>
          <Field label="Moneda (código ISO, ej COP)">
            <input value={draft.currency} onChange={(e) => set({ currency: e.target.value })} className="field" />
          </Field>
          <Field label="Región (ej es-CO)">
            <input value={draft.locale} onChange={(e) => set({ locale: e.target.value })} className="field" />
          </Field>
          <Field label="Última actualización de políticas">
            <input
              type="date"
              value={draft.legalUpdatedAt ?? ''}
              onChange={(e) => set({ legalUpdatedAt: e.target.value || null })}
              className="field"
            />
          </Field>
        </div>
      </div>

      <div className="card-surface p-6">
        <h3 className="font-display text-lg uppercase tracking-tight">Portada del inicio</h3>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Puedes dejar una sola foto o cargar varias para que cambien solas: al azar en cada visita
          o por día/semana.
        </p>
        <div className="mt-5">
          <AdminHeroImages site={draft} onChange={set} />
        </div>
      </div>

      <div className="card-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg uppercase tracking-tight">
              <Mail className="h-5 w-5 text-brand" /> Correo de recuperación
            </h3>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/45">
              La recuperación de contraseña envía un código de 6 dígitos al correo del cliente. Con el
              mismo proveedor Resend se envían la confirmación de compra y la guía de envío.
            </p>
          </div>
          {emailLoading ? (
            <span className="inline-flex items-center gap-2 text-xs text-white/45">
              <Loader2 className="h-4 w-4 animate-spin" /> Comprobando…
            </span>
          ) : emailHealth?.ready ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              <Check className="h-3.5 w-3.5" /> Operativo con{' '}
              {emailHealth.provider === 'resend' ? 'Resend' : 'EmailJS'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" /> Usando enlace de Supabase Auth
            </span>
          )}
        </div>

        {!emailLoading && !emailHealth?.ready && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-white/60">
            <p className="font-semibold text-white/85">Cómo funciona ahora</p>
            <p className="mt-2 text-white/50">
              Si hay proveedor de códigos configurado, el cliente recibe un código de 6 dígitos. Si no,
              se envía automáticamente un enlace de recuperación con el correo nativo de Supabase Auth.
            </p>
            <ul className="mt-3 space-y-1 text-white/50">
              <li>Proveedor de códigos: Resend ({emailHealth?.resend ? 'OK' : 'no'}) o EmailJS ({emailHealth?.emailjs ? 'OK' : 'no'}).</li>
              <li>Secreto PASSWORD_RESET_PEPPER: {emailHealth?.pepper ? 'OK' : 'no'}.</li>
              <li>URL pública SITE_URL: {emailHealth?.siteUrl ? 'OK' : 'no'}.</li>
              <li>Si esta tarjeta no responde, despliega la función <strong className="text-white/70">email-health</strong>.</li>
            </ul>
            <p className="mt-3 text-white/45">
              Para usar códigos propios configura en Supabase → Edge Functions → Secrets:
              <strong className="text-white/70"> RESEND_API_KEY</strong> y
              <strong className="text-white/70"> RESET_FROM_EMAIL</strong>. Después vuelve a desplegar
              <strong className="text-white/70"> request-password-reset</strong>. Para el enlace nativo,
              revisa Authentication → URL Configuration y el SMTP en Authentication → Emails.
            </p>
          </div>
        )}
      </div>

      <div className="card-surface p-6">
        <h3 className="font-display text-lg uppercase tracking-tight">Texto de sección destacada</h3>
        <p className="mt-1 text-xs text-white/45">
          Personaliza el encabezado de la sección «Piezas destacadas» del inicio. La última palabra del
          título se resalta en rojo.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Encabezado (eyebrow)">
            <input
              value={draft.featuredEyebrow ?? ''}
              onChange={(e) => set({ featuredEyebrow: e.target.value })}
              className="field"
              placeholder="Selección"
            />
          </Field>
          <Field label="Título">
            <input
              value={draft.featuredTitle ?? ''}
              onChange={(e) => set({ featuredTitle: e.target.value })}
              className="field"
              placeholder="Piezas destacadas"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción">
              <textarea
                rows={2}
                value={draft.featuredDescription ?? ''}
                onChange={(e) => set({ featuredDescription: e.target.value })}
                className="field resize-none"
                placeholder="Los favoritos de la comunidad. Desliza para recorrer la colección."
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={reset}
          className="btn-ghost !py-2.5 !text-[12px]"
        >
          <RotateCcw className="h-4 w-4" /> Restablecer valores originales
        </button>
        <button
          onClick={save}
          disabled={saving}
          className={saved ? 'btn-primary !bg-emerald-500' : 'btn-primary disabled:opacity-60'}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Guardado
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar cambios'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
        {label}
      </label>
      {children}
    </div>
  )
}
