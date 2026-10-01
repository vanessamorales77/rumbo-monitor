import './NoVehicles.css'

/** A successful sign-in on an account without devices: say what is going on instead of leaving an empty column. */
export function NoVehicles() {
  return (
    <section className="no-vehicles" aria-labelledby="no-vehicles-title">
      <h2 id="no-vehicles-title" className="no-vehicles__title">
        Todavía no hay vehículos
      </h2>
      <p className="no-vehicles__body">
        La conexión con Traccar funciona, pero esta cuenta no tiene dispositivos. Crea uno en Traccar y aparecerá aquí.
      </p>
    </section>
  )
}
