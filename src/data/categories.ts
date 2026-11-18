import type { Category } from '@/types'

export const categories: Category[] = [
  {
    id: 'camisetas',
    name: 'Camisetas',
    short: 'Camisetas',
    description: 'Prendas que declaran tu pasión por los motores.',
    accent: '#FF1E2D',
    image: '/images/categories/camisetas.jpg',
    order: 1,
  },
  {
    id: 'accesorios',
    name: 'Accesorios',
    short: 'Accesorios',
    description: 'Detalles que transforman tu carro y tu experiencia al volante.',
    accent: '#FF1E2D',
    image: '/images/categories/accesorios.jpg',
    order: 2,
  },
  {
    id: 'coleccionables',
    name: 'Coleccionables',
    short: 'Coleccionables',
    description: 'Réplicas para atesorar y exhibir la leyenda del motor.',
    accent: '#FF1E2D',
    image: '/images/categories/coleccionables.jpg',
    order: 3,
  },
]

export const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c])) as Record<
  Category['id'],
  Category
>
