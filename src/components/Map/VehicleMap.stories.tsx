import { useEffect, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import routes from '../../api/demoRoutes.json'
import { createWalker, type LatLon } from '../../api/routeWalker'
import { makeDevice, makePosition } from '../fixtures'
import { VehicleMap } from './VehicleMap'

const meta = {
  title: 'Componentes/Mapa',
  component: VehicleMap,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Mapa de Leaflet con un marcador SVG que muestra la dirección (`course`) y el estado de conexión. Se desliza entre posiciones y el mapa lo mantiene en el centro; si el operador arrastra el mapa o usa las flechas, vuelve al vehículo con suavidad en cuanto llega la siguiente posición. Mientras cargan los _tiles_ se muestra la cubierta de carga, que se desvanece. Necesita red para cargar los _tiles_.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 'min(100%, 36rem)', height: '26rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VehicleMap>

export default meta
type Story = StoryObj<typeof meta>

const route = (routes as unknown as Record<string, LatLon[]>)['rumbo-npr-01']

/** Drives a vehicle along a real street route, one fix every 2 s, like the app's simulator. */
function MovingVehicle({ status }: { status: 'online' | 'offline' | 'unknown' }) {
  const walker = useMemo(() => createWalker(route), [])
  const [distance, setDistance] = useState(walker.total * 0.1)

  useEffect(() => {
    const timer = setInterval(() => setDistance((d) => d + 11 * 2), 2_000)
    return () => clearInterval(timer)
  }, [])

  const here = walker.at(distance)
  const position = makePosition({
    speedKmh: 40,
    course: here.bearing,
    latitude: here.lat,
    longitude: here.lon,
    ageSeconds: 0,
  })
  return <VehicleMap device={makeDevice({ status })} position={position} />
}

export const EnMovimiento: Story = {
  name: 'En movimiento (arrastra el mapa: vuelve en la siguiente posición)',
  args: { device: makeDevice(), position: makePosition() },
  render: () => <MovingVehicle status="online" />,
}

export const SinConexion: Story = {
  name: 'Vehículo sin conexión (aro discontinuo)',
  args: { device: makeDevice({ status: 'offline' }), position: makePosition({ speedKmh: 34, ageSeconds: 3600 }) },
}

export const Desconocido: Story = {
  name: 'Estado desconocido (aro punteado)',
  args: { device: makeDevice({ status: 'unknown' }), position: makePosition({ speedKmh: 0, ageSeconds: 7200 }) },
}

export const SinPosicion: Story = {
  name: 'Sin posición todavía',
  args: { device: makeDevice({ status: 'unknown' }), position: null },
}
