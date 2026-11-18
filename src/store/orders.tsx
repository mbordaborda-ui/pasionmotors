import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Order } from '@/types'
import { supabase } from '@/lib/supabase'
import { rowToOrder, type OrderRow } from '@/lib/db'
import { describeError, reportSaveError, type SaveResult } from '@/lib/save'
import { withTimeout } from '@/lib/timeout'
import { useAuth } from '@/store/auth'

const ORDER_SELECT = `
  *,
  order_items ( product_id, name, qty, price, selections ),
  order_gifts ( gift_id, name )
`

async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as OrderRow[]).map(rowToOrder)
}

interface OrdersContextValue {
  orders: Order[]
  loading: boolean
  refresh: () => Promise<void>
  /**
   * Cancela un pedido PENDIENTE y libera el stock reservado.
   * Los pedidos pagados no se borran ni se cancelan desde el panel: son el
   * registro contable y legal de la venta (los reembolsos se gestionan en
   * Mercado Pago y quedan auditados).
   */
  cancelOrder: (id: string) => Promise<SaveResult>
}

const OrdersContext = createContext<OrdersContextValue | null>(null)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    // Sin sesión no hay pedidos que mostrar: evitamos una petición global
    // en cada visita a la tienda.
    if (!user) {
      setOrders([])
      setLoading(false)
      return
    }
    try {
      setOrders(
        await withTimeout(
          fetchOrders(),
          12_000,
          'Los pedidos tardaron demasiado en cargar.',
        ),
      )
    } catch (err) {
      console.error('[orders.refresh]', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh()
  }, [refresh, user])

  useEffect(() => {
    if (!user) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 400)
    }
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, schedule)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [refresh, user])

  const cancelOrder = useCallback(
    async (id: string): Promise<SaveResult> => {
      const { data, error } = await supabase.rpc('admin_cancel_pending_order', {
        p_order_id: id,
      })

      if (error) {
        const message = describeError(error)
        reportSaveError('No se pudo cancelar el pedido.', message)
        return { ok: false, error: message }
      }

      const res = data as { ok?: boolean; error?: string; status?: string } | null
      if (!res?.ok) {
        const message =
          res?.error === 'not_pending'
            ? `El pedido está en estado «${res.status ?? 'cerrado'}» y ya no se puede cancelar.`
            : res?.error === 'not_found'
              ? 'El pedido ya no existe.'
              : res?.error === 'not_allowed'
                ? 'Solo un administrador puede cancelar pedidos.'
                : 'La base de datos no confirmó la cancelación.'
        reportSaveError('No se pudo cancelar el pedido.', message)
        return { ok: false, error: message }
      }

      await refresh()
      return { ok: true }
    },
    [refresh],
  )

  const value: OrdersContextValue = { orders, loading, refresh, cancelOrder }

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error('useOrders debe usarse dentro de <OrdersProvider>')
  return ctx
}
