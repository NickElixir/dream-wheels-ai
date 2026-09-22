export type CompatibilityStatus = 'verified' | 'pending' | 'unknown';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  generation?: string;
  yearLabel?: string;
  displayName: string;
  bodyLabel: string;
  image: { src: string; width: number; height: number; alt: string };
}

export interface Wheel {
  id: string;
  brand: string;
  model: string;
  finish: string;
  sku: string;
  diameter: number;
  width: number;
  pcd: string;
  et: number;
  dia: number;
  thumbnail: { src: string; width: number; height: number; alt: string };
}

export interface ShowcaseVariant {
  id: string;
  vehicleId: string;
  wheelId: string;
  image: Vehicle['image'];
  compatibility: {
    status: CompatibilityStatus;
    checkedBy?: string;
    checkedAt?: string;
    sourceReference?: string;
    exactVehicleConfiguration?: string;
    exactWheelConfiguration?: string;
  };
  isMock: boolean;
}

const vehicleImage = (src: string, alt: string, width = 1536, height = 1024) => ({
  src,
  width,
  height,
  alt,
});

export const vehicles: Vehicle[] = [
  {
    id: 'zeekr-001',
    make: 'Zeekr',
    model: '001',
    generation: 'First generation',
    yearLabel: '2021—',
    displayName: 'Zeekr 001',
    bodyLabel: 'Electric shooting brake',
    image: vehicleImage('/assets/mock/zeekr-001-black.png', 'Editorial render of a black Zeekr 001 in a dark garage'),
  },
  {
    id: 'bmw-x5',
    make: 'BMW',
    model: 'X5',
    generation: 'G05',
    yearLabel: '2018—',
    displayName: 'BMW X5',
    bodyLabel: 'Premium SUV',
    image: vehicleImage('/assets/mock/bmw-x5.webp', 'Mock editorial render of a dark BMW X5 in a dark garage'),
  },
  {
    id: 'mercedes-gle',
    make: 'Mercedes-Benz',
    model: 'GLE',
    generation: 'V167',
    yearLabel: '2019—',
    displayName: 'Mercedes-Benz GLE',
    bodyLabel: 'Luxury SUV',
    image: vehicleImage('/assets/mock/mercedes-gle.webp', 'Mock editorial render of a white Mercedes-Benz GLE in a dark garage'),
  },
  {
    id: 'li-auto-l7',
    make: 'Li Auto',
    model: 'L7',
    generation: 'First generation',
    yearLabel: '2023—',
    displayName: 'Li Auto L7',
    bodyLabel: 'Premium hybrid SUV',
    image: vehicleImage('/assets/mock/li-auto-l7-current.png', 'Editorial render of a red Li Auto L7 in a dark garage'),
  },
  {
    id: 'geely-cityray',
    make: 'Geely',
    model: 'Atlas',
    generation: 'First generation',
    yearLabel: '2024—',
    displayName: 'Geely Atlas',
    bodyLabel: 'Urban crossover',
    image: vehicleImage('/assets/mock/geely-atlas.png', 'Geely Atlas in a dark garage', 1536, 1024),
  },
];

export const wheels: Wheel[] = [
  {
    id: 'wheel-a',
    brand: 'DW Studio',
    model: 'SVR Premium',
    finish: 'Satin graphite',
    sku: 'MOCK-A01',
    diameter: 19,
    width: 8.5,
    pcd: '5×114.3',
    et: 35,
    dia: 67.1,
    thumbnail: { src: '/assets/mock/wheel-audition-svr-premium.png', width: 1254, height: 1254, alt: 'SVR Premium transparent wheel example' },
  },
  {
    id: 'wheel-b',
    brand: 'DW Studio',
    model: 'MOMO',
    finish: 'Brushed silver',
    sku: 'MOCK-B02',
    diameter: 20,
    width: 9,
    pcd: '5×112',
    et: 40,
    dia: 66.6,
    thumbnail: { src: '/assets/mock/wheel-audition-momo.png', width: 1254, height: 1254, alt: 'MOMO transparent wheel example' },
  },
  {
    id: 'wheel-c',
    brand: 'DW Studio',
    model: 'Venti',
    finish: 'Brushed silver',
    sku: 'MOCK-C03',
    diameter: 18,
    width: 8,
    pcd: '5×114.3',
    et: 38,
    dia: 67.1,
    thumbnail: { src: '/assets/mock/wheel-audition-venti.png', width: 1254, height: 1254, alt: 'Venti transparent wheel example' },
  },
];

export const showcaseVariants: ShowcaseVariant[] = vehicles.flatMap((vehicle, vehicleIndex) =>
  wheels.map((wheel, wheelIndex) => ({
    id: `${vehicle.id}-${wheel.id}`,
    vehicleId: vehicle.id,
    wheelId: wheel.id,
    image: vehicle.image,
    compatibility: {
      status: wheelIndex === 1 && vehicleIndex === 0 ? 'unknown' : 'pending',
      sourceReference: 'MOCK_CATALOG_DATA_V1',
      exactVehicleConfiguration: `${vehicle.displayName} / ${vehicle.generation}`,
      exactWheelConfiguration: `${wheel.brand} ${wheel.model} / ${wheel.sku}`,
    },
    isMock: true,
  })),
);

export const getVehicle = (id: string) => vehicles.find((vehicle) => vehicle.id === id);
export const getWheel = (id: string) => wheels.find((wheel) => wheel.id === id);
export const getVariantsForVehicle = (vehicleId: string) => showcaseVariants.filter((variant) => variant.vehicleId === vehicleId);
export const getVariant = (vehicleId: string, wheelId: string) =>
  showcaseVariants.find((variant) => variant.vehicleId === vehicleId && variant.wheelId === wheelId);
