export interface Driver {
  id: string
  name: string
  phone: string | null
}

export interface CarType {
  id: string
  name: string
  maxCapacity: number
}

export interface PriceTier {
  id: string
  minPax: number
  maxPax: number
  price: number
}

export interface Passenger {
  id: string
  name: string | null
  phone: string | null
  flightNumber: string | null
  arrivalDate: string | null
  arrivalTime: string | null
  pickupTime: string | null
  origin: string | null
  destination: string | null
  isDone: boolean
  cabId: string | null
  cabColor: string | null
  cabStartedAt: string | null
  cabIsDone: boolean
  cabDoneBy: string | null
  additionalDetails: string | null
  additionalDetailsUpdatedBy: string | null
  cabNumber: number | null
  cabDriverName: string | null
  cabDriverChangedBy: string | null
  cabPaxCount: number
  cabCarTypeId: string | null
  cabCarTypeName: string | null
  cabPrice: number | null
  isDeleted: boolean
  createdManually: boolean
  isEdited: boolean
  editedFields: string[]
}

export interface Cab {
  id: string
  label: string
  driverId: string | null
  driverName: string | null
  driverChangedBy: string | null
  color: string | null
  startedAt: string | null
  isDone: boolean
  carTypeId: string | null
  carTypeName: string | null
  price: number | null
  paxCount: number
  passengers: Passenger[]
}

export interface Project {
  id: string
  name: string
  createdAt: string
  lastUpdatedAt: string
  lastMessageDate: string | null
}
