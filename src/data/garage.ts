/**
 * Autos destacados ("garage"). Esta es la galería por defecto; el admin puede
 * reemplazarla desde el panel y se guarda en `site_settings.garage`.
 *
 * Fotografías de Pexels — licencia libre para uso comercial, sin atribución
 * obligatoria (https://www.pexels.com/license/). Los IDs fueron verificados
 * (respuesta HTTP 200 / image/jpeg). Para cambiar una foto basta reemplazar el
 * ID de Pexels o poner tu propia URL pública (también acepta enlaces de Drive).
 */
import type { GarageCar } from '@/types'

export type { GarageCar }

const pexels = (id: number, w = 1400) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`

export const garage: GarageCar[] = [
  {
    id: 'porsche-911-gt3-rs',
    name: 'Porsche 911 GT3 RS',
    tag: 'Leyenda',
    note: 'Verde, radical y sin filtros. La aerodinámica de competición hecha calle.',
    image: '/images/hero/porsche-green.jpg',
  },
  {
    id: 'porsche-911',
    name: 'Porsche 911 Carrera',
    tag: 'Icónico',
    note: 'Elegancia atemporal y precisión alemana en cada curva.',
    image: pexels(39578151),
  },
  {
    id: 'shelby-gt500',
    name: 'Mustang Shelby GT500',
    tag: 'Muscle',
    note: 'Fuerza americana sin filtros. El rugido que define una era.',
    image: pexels(8547649),
  },
  {
    id: 'bmw-m6',
    name: 'BMW M6',
    tag: 'Elegancia',
    note: 'Velocidad con clase: potencia refinada y elegancia en cada detalle.',
    image: pexels(15688673),
  },
  {
    id: 'toyota-supra',
    name: 'Toyota Supra',
    tag: 'JDM',
    note: 'Leyenda japonesa de los 90. El rugido del 2JZ que todos quieren escuchar.',
    image: pexels(15035510),
  },
  {
    id: 'chevrolet-1957',
    name: 'Chevrolet 1957',
    tag: 'Clásico',
    note: 'Cromado, aletas y rock and roll. Un clásico americano que nunca pasa de moda.',
    image: pexels(248687),
  },
  {
    id: 'citroen-clasico',
    name: 'Citroën Clásico',
    tag: 'Clásico',
    note: 'Elegancia europea atemporal: sencillez, carácter y nostalgia en cada detalle.',
    image: pexels(30141508),
  },
  {
    id: 'jeep-wrangler',
    name: 'Jeep Wrangler',
    tag: 'Offroad',
    note: 'Terreno imposible, diversión garantizada. El 4x4 que no se detiene ante nada.',
    image: pexels(17420165),
  },
  {
    id: 'ford-bronco',
    name: 'Ford Bronco',
    tag: 'Offroad',
    note: 'Aventura sin límites: donde termina el asfalto, empieza el terreno del Bronco.',
    image: pexels(18205407),
  },
]
