/** Fleet names are written "Model · PLATE" (the convention of the demo fleet). Without that shape the whole name is the title. */
/** How a vehicle is named in a list: "Chevrolet NPR (ABC-123)". */
export function vehicleLabel(name: string): string {
  const { model, plate } = splitVehicleName(name)
  return plate ? `${model} (${plate})` : model
}

export function splitVehicleName(name: string): { model: string; plate: string | null } {
  const match = name.match(/^(.*\S)\s+[·|•]\s+([A-Za-z0-9-]{4,10})$/)
  return match ? { model: match[1], plate: match[2].toUpperCase() } : { model: name, plate: null }
}
