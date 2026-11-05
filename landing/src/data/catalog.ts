// Static catalog data. Design previews do not establish SKU finish, dimensions or fitment.
export type CompatibilityStatus = 'verified' | 'pending' | 'unknown';
export interface CatalogImage { src: string; width: number; height: number; alt: string; srcSet?: string }
export interface Vehicle { id: string; make: string; model: string; generation?: string; yearLabel?: string; displayName: string; bodyLabel: string; image: CatalogImage }
export interface Wheel { id: string; brand: string; model: string; displayName: string; finish: string | null; referenceBarcode: string; thumbnail: CatalogImage }
export interface WheelSku { id: string; wheelId: string; sku: string; fullName: string; diameter: number | null; width: number | null; pcd: string | null; et: number | null; dia: number | null; source: string; sourceReferences: string[] }
export interface ShowcaseVariant { id: string; vehicleId: string; wheelId: string; skuIds: string[]; image: CatalogImage; compatibility: { status: CompatibilityStatus; sourceReference: string }; isMock: boolean; isGenerated: boolean }
const vehicleImage = (src: string, alt: string, width = 1536, height = 1024): CatalogImage => ({ src, width, height, alt });
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
    image: vehicleImage('/assets/mock/bmw-x5.webp', 'BMW X5 in a dark garage', 1400, 933),
  },
  {
    id: 'mercedes-gle',
    make: 'Mercedes-Benz',
    model: 'GLE',
    generation: 'V167',
    yearLabel: '2019—',
    displayName: 'Mercedes-Benz GLE',
    bodyLabel: 'Luxury SUV',
    image: vehicleImage('/assets/mock/mercedes-gle.webp', 'Mercedes-Benz GLE in a dark garage', 1400, 933),
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
    "id": "wheel-104597021630",
    "brand": "LS Forged",
    "model": "FG14",
    "displayName": "LS Forged FG14",
    "finish": null,
    "referenceBarcode": "104597021630",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-104597021630-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-104597021630-320.webp 320w, /assets/catalog/cutouts-v1/reference-104597021630-640.webp 640w",
      "alt": "LS Forged FG14 — reference"
    }
  },
  {
    "id": "wheel-125847429328",
    "brand": "КиК",
    "model": "Элерон",
    "displayName": "КиК Элерон",
    "finish": null,
    "referenceBarcode": "125847429328",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-125847429328-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-125847429328-320.webp 320w, /assets/catalog/cutouts-v1/reference-125847429328-640.webp 640w",
      "alt": "КиК Элерон — reference"
    }
  },
  {
    "id": "wheel-95044209621",
    "brand": "REPLAY",
    "model": "MR208",
    "displayName": "REPLAY MR208",
    "finish": null,
    "referenceBarcode": "95044209621",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-95044209621-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-95044209621-320.webp 320w, /assets/catalog/cutouts-v1/reference-95044209621-640.webp 640w",
      "alt": "REPLAY MR208 — reference"
    }
  },
  {
    "id": "wheel-107192878785",
    "brand": "X'trike",
    "model": "X-137",
    "displayName": "X'trike X-137",
    "finish": null,
    "referenceBarcode": "107192878785",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-107192878785-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-107192878785-320.webp 320w, /assets/catalog/cutouts-v1/reference-107192878785-640.webp 640w",
      "alt": "X'trike X-137 — reference"
    }
  },
  {
    "id": "wheel-100987003598",
    "brand": "LS FlowForming",
    "model": "RC55",
    "displayName": "LS FlowForming RC55",
    "finish": null,
    "referenceBarcode": "100987003598",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-100987003598-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-100987003598-320.webp 320w, /assets/catalog/cutouts-v1/reference-100987003598-640.webp 640w",
      "alt": "LS FlowForming RC55 — reference"
    }
  },
  {
    "id": "wheel-109398868737",
    "brand": "СКАД Premium",
    "model": "КР014",
    "displayName": "СКАД Premium КР014",
    "finish": null,
    "referenceBarcode": "109398868737",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-109398868737-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-109398868737-320.webp 320w, /assets/catalog/cutouts-v1/reference-109398868737-640.webp 640w",
      "alt": "СКАД Premium КР014 — reference"
    }
  },
  {
    "id": "wheel-100309984417",
    "brand": "Replica FR",
    "model": "BMW B495",
    "displayName": "Replica FR BMW B495",
    "finish": null,
    "referenceBarcode": "100309984417",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-100309984417-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-100309984417-320.webp 320w, /assets/catalog/cutouts-v1/reference-100309984417-640.webp 640w",
      "alt": "Replica FR BMW B495 — reference"
    }
  },
  {
    "id": "wheel-106265943070",
    "brand": "LS Forged",
    "model": "FG05",
    "displayName": "LS Forged FG05",
    "finish": null,
    "referenceBarcode": "106265943070",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-106265943070-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-106265943070-320.webp 320w, /assets/catalog/cutouts-v1/reference-106265943070-640.webp 640w",
      "alt": "LS Forged FG05 — reference"
    }
  },
  {
    "id": "wheel-123881154785",
    "brand": "RST",
    "model": "R2204FF",
    "displayName": "RST R2204FF",
    "finish": null,
    "referenceBarcode": "123881154785",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-123881154785-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-123881154785-320.webp 320w, /assets/catalog/cutouts-v1/reference-123881154785-640.webp 640w",
      "alt": "RST R2204FF — reference"
    }
  },
  {
    "id": "wheel-88731778597",
    "brand": "LEGE ARTIS",
    "model": "Concept-B531",
    "displayName": "LEGE ARTIS Concept-B531",
    "finish": null,
    "referenceBarcode": "88731778597",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-88731778597-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-88731778597-320.webp 320w, /assets/catalog/cutouts-v1/reference-88731778597-640.webp 640w",
      "alt": "LEGE ARTIS Concept-B531 — reference"
    }
  },
  {
    "id": "wheel-111785217385",
    "brand": "СКАД Premium",
    "model": "КР008",
    "displayName": "СКАД Premium КР008",
    "finish": null,
    "referenceBarcode": "111785217385",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-111785217385-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-111785217385-320.webp 320w, /assets/catalog/cutouts-v1/reference-111785217385-640.webp 640w",
      "alt": "СКАД Premium КР008 — reference"
    }
  },
  {
    "id": "wheel-120901095121",
    "brand": "Race Ready Technology",
    "model": "CSSYA5640",
    "displayName": "Race Ready Technology CSSYA5640",
    "finish": null,
    "referenceBarcode": "120901095121",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-120901095121-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-120901095121-320.webp 320w, /assets/catalog/cutouts-v1/reference-120901095121-640.webp 640w",
      "alt": "Race Ready Technology CSSYA5640 — reference"
    }
  },
  {
    "id": "wheel-124130035944",
    "brand": "Race Ready Technology",
    "model": "CSSYA2012",
    "displayName": "Race Ready Technology CSSYA2012",
    "finish": null,
    "referenceBarcode": "124130035944",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-124130035944-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-124130035944-320.webp 320w, /assets/catalog/cutouts-v1/reference-124130035944-640.webp 640w",
      "alt": "Race Ready Technology CSSYA2012 — reference"
    }
  },
  {
    "id": "wheel-85636297741",
    "brand": "Replica FR",
    "model": "ZEEKR IVF-3166",
    "displayName": "Replica FR ZEEKR IVF-3166",
    "finish": null,
    "referenceBarcode": "85636297741",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-85636297741-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-85636297741-320.webp 320w, /assets/catalog/cutouts-v1/reference-85636297741-640.webp 640w",
      "alt": "Replica FR ZEEKR IVF-3166 — reference"
    }
  },
  {
    "id": "wheel-120494859048",
    "brand": "",
    "model": "СКАД Арика",
    "displayName": "СКАД Арика",
    "finish": null,
    "referenceBarcode": "120494859048",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-120494859048-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-120494859048-320.webp 320w, /assets/catalog/cutouts-v1/reference-120494859048-640.webp 640w",
      "alt": "СКАД Арика — reference"
    }
  },
  {
    "id": "wheel-126269312705",
    "brand": "КиК",
    "model": "Клермон",
    "displayName": "КиК Клермон",
    "finish": null,
    "referenceBarcode": "126269312705",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-126269312705-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-126269312705-320.webp 320w, /assets/catalog/cutouts-v1/reference-126269312705-640.webp 640w",
      "alt": "КиК Клермон — reference"
    }
  },
  {
    "id": "wheel-115612627376",
    "brand": "",
    "model": "СКАД Манчестер",
    "displayName": "СКАД Манчестер",
    "finish": null,
    "referenceBarcode": "115612627376",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-115612627376-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-115612627376-320.webp 320w, /assets/catalog/cutouts-v1/reference-115612627376-640.webp 640w",
      "alt": "СКАД Манчестер — reference"
    }
  },
  {
    "id": "wheel-109398879950",
    "brand": "СКАД Premium",
    "model": "КР014",
    "displayName": "СКАД Premium КР014",
    "finish": null,
    "referenceBarcode": "109398879950",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-109398879950-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-109398879950-320.webp 320w, /assets/catalog/cutouts-v1/reference-109398879950-640.webp 640w",
      "alt": "СКАД Premium КР014 — reference"
    }
  },
  {
    "id": "wheel-118754944354",
    "brand": "X'trike",
    "model": "X-141",
    "displayName": "X'trike X-141",
    "finish": null,
    "referenceBarcode": "118754944354",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-118754944354-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-118754944354-320.webp 320w, /assets/catalog/cutouts-v1/reference-118754944354-640.webp 640w",
      "alt": "X'trike X-141 — reference"
    }
  },
  {
    "id": "wheel-123388297342",
    "brand": "Replica FR",
    "model": "Lixiang IVF-3164",
    "displayName": "Replica FR Lixiang IVF-3164",
    "finish": null,
    "referenceBarcode": "123388297342",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-123388297342-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-123388297342-320.webp 320w, /assets/catalog/cutouts-v1/reference-123388297342-640.webp 640w",
      "alt": "Replica FR Lixiang IVF-3164 — reference"
    }
  },
  {
    "id": "wheel-120056032523",
    "brand": "Khomen Wheels",
    "model": "KHW2101",
    "displayName": "Khomen Wheels KHW2101",
    "finish": null,
    "referenceBarcode": "120056032523",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-120056032523-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-120056032523-320.webp 320w, /assets/catalog/cutouts-v1/reference-120056032523-640.webp 640w",
      "alt": "Khomen Wheels KHW2101 — reference"
    }
  },
  {
    "id": "wheel-115592534608",
    "brand": "СКАД Premium",
    "model": "Kleemann",
    "displayName": "СКАД Premium Kleemann",
    "finish": null,
    "referenceBarcode": "115592534608",
    "thumbnail": {
      "src": "/assets/catalog/cutouts-v1/reference-115592534608-640.webp",
      "width": 640,
      "height": 640,
      "srcSet": "/assets/catalog/cutouts-v1/reference-115592534608-320.webp 320w, /assets/catalog/cutouts-v1/reference-115592534608-640.webp 640w",
      "alt": "СКАД Premium Kleemann — reference"
    }
  }
];

export const wheelSkus: WheelSku[] = [
  {
    "id": "sku-97a737ed66a9",
    "wheelId": "wheel-104597021630",
    "sku": "S087057",
    "fullName": "LS Forged FG14 10,0\\R22 5*112 ET55 d66,6 BK",
    "width": 10.0,
    "diameter": 22.0,
    "pcd": "5×112",
    "et": 55.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_6.pdf",
    "sourceReferences": [
      "Mercedes_GLE_6.pdf"
    ]
  },
  {
    "id": "sku-7178795414ca",
    "wheelId": "wheel-125847429328",
    "sku": "83889",
    "fullName": "КиК Элерон (КС1168) 9,0\\R20 5*112 ET53 d66,6 Кварц",
    "width": 9.0,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 53.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_2.pdf",
    "sourceReferences": [
      "Mercedes_GLE_2.pdf"
    ]
  },
  {
    "id": "sku-1077b81efbff",
    "wheelId": "wheel-95044209621",
    "sku": "083514-160060110",
    "fullName": "REPLAY MR208 10,0\\R21 5*112 ET54 d66,6 GMF",
    "width": 10.0,
    "diameter": 21.0,
    "pcd": "5×112",
    "et": 54.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_3.pdf",
    "sourceReferences": [
      "Mercedes_GLE_3.pdf"
    ]
  },
  {
    "id": "sku-261e98a6caf7",
    "wheelId": "wheel-95044209621",
    "sku": "D07018",
    "fullName": "REPLAY MR208 10,0\\R21 5*112 ET54 d66,6 GMF",
    "width": 10.0,
    "diameter": 21.0,
    "pcd": "5×112",
    "et": 54.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_3.pdf",
    "sourceReferences": [
      "Mercedes_GLE_3.pdf"
    ]
  },
  {
    "id": "sku-99321f5e9742",
    "wheelId": "wheel-107192878785",
    "sku": "351207AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET37 d66,6 BK/FP Audi A8 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 37.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_1.pdf",
    "sourceReferences": [
      "Mercedes_GLE_1.pdf"
    ]
  },
  {
    "id": "sku-6183a664c230",
    "wheelId": "wheel-107192878785",
    "sku": "351211AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET40 d66,6 BK/FP MB GLC Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 40.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_1.pdf",
    "sourceReferences": [
      "Mercedes_GLE_1.pdf"
    ]
  },
  {
    "id": "sku-16ae08badc19",
    "wheelId": "wheel-107192878785",
    "sku": "351215AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET50 d66,6 BK/FP MB GLE/GLS Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 50.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_2.pdf",
    "sourceReferences": [
      "Mercedes_GLE_2.pdf"
    ]
  },
  {
    "id": "sku-eab9edd28d50",
    "wheelId": "wheel-107192878785",
    "sku": "351217AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET50 d66,6 BKM/FP MB GLE/GLS Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 50.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_2.pdf",
    "sourceReferences": [
      "Mercedes_GLE_2.pdf"
    ]
  },
  {
    "id": "sku-2da5b9b375ce",
    "wheelId": "wheel-107192878785",
    "sku": "351218AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET50 d66,6 BH MB GLE/GLS Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 50.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_2.pdf",
    "sourceReferences": [
      "Mercedes_GLE_2.pdf"
    ]
  },
  {
    "id": "sku-3d01f641bfaa",
    "wheelId": "wheel-107192878785",
    "sku": "351232AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET43 d66,6 BKM Audi A6 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 43.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_4.pdf",
    "sourceReferences": [
      "Mercedes_GLE_4.pdf"
    ]
  },
  {
    "id": "sku-992387d42c21",
    "wheelId": "wheel-107192878785",
    "sku": "351233AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET43 d66,6 BKM/FP Audi A6 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 43.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_4.pdf",
    "sourceReferences": [
      "Mercedes_GLE_4.pdf"
    ]
  },
  {
    "id": "sku-3c39d2ffb5cf",
    "wheelId": "wheel-100987003598",
    "sku": "D83356",
    "fullName": "LS FlowForming RC55 8,5\\R20 5*112 ET40 d66,6 MGM",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 40.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_1.pdf",
    "sourceReferences": [
      "Mercedes_GLE_1.pdf"
    ]
  },
  {
    "id": "sku-481536945a42",
    "wheelId": "wheel-109398868737",
    "sku": "79387",
    "fullName": "СКАД Premium КР014 (20Audi Q5) 8,0\\R20 5*112 ET39 d66,6 Diamond gloss graphite <С> Fb max 840 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 39.0,
    "dia": 66.6,
    "source": "Mercedes_GLE_1.pdf",
    "sourceReferences": [
      "Mercedes_GLE_1.pdf"
    ]
  },
  {
    "id": "sku-484b58b8790a",
    "wheelId": "wheel-100309984417",
    "sku": "20/63/26/878",
    "fullName": "Replica FR BMW B495 9,5\\R22 5*112 ET32 d66,6 BMF X5G/X6G/X7G style 818M Competition front/rear",
    "width": 9.5,
    "diameter": 22.0,
    "pcd": "5×112",
    "et": 32.0,
    "dia": 66.6,
    "source": "BMW_X5_4.pdf",
    "sourceReferences": [
      "BMW_X5_4.pdf"
    ]
  },
  {
    "id": "sku-2f597dcf3edd",
    "wheelId": "wheel-106265943070",
    "sku": "S087344",
    "fullName": "LS Forged FG05 9,0\\R20 5*112 ET35 d66,6 MGM",
    "width": 9.0,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 35.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-234d4bf5e142",
    "wheelId": "wheel-123881154785",
    "sku": "RR2204FF-9522-666-5x112-32BLM",
    "fullName": "RST R2204FF FlowForming 9,5\\R22 5*112 ET32 d66,6 BLM BMW X5/X6 IV X7 G07 Fb max 955 kg",
    "width": 9.5,
    "diameter": 22.0,
    "pcd": "5×112",
    "et": 32.0,
    "dia": 66.6,
    "source": "BMW_X5_4.pdf",
    "sourceReferences": [
      "BMW_X5_4.pdf"
    ]
  },
  {
    "id": "sku-c561a5bf193c",
    "wheelId": "wheel-88731778597",
    "sku": "9264822",
    "fullName": "LEGE ARTIS Concept-B531 10,0\\R20 5*112 ET40 d66,6 BKF",
    "width": 10.0,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 40.0,
    "dia": 66.6,
    "source": "BMW_X5_3.pdf",
    "sourceReferences": [
      "BMW_X5_3.pdf"
    ]
  },
  {
    "id": "sku-fdb469605bb2",
    "wheelId": "wheel-107192878785",
    "sku": "351187AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET30 d66,6 BK/FP Audi A7 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 30.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-001cf622fd7a",
    "wheelId": "wheel-107192878785",
    "sku": "351188AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET30 d66,6 BKM Audi A7 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 30.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-2d3d0e7df5f5",
    "wheelId": "wheel-107192878785",
    "sku": "351189AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET30 d66,6 BKM/FP Audi A7 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 30.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-ea51d3e7138f",
    "wheelId": "wheel-107192878785",
    "sku": "351190AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET30 d66,6 BH Audi A7 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 30.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-783f5b8f5412",
    "wheelId": "wheel-107192878785",
    "sku": "351191AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET33 d66,6 BK/FP Audi Q5 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 33.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-7b42f92bf243",
    "wheelId": "wheel-107192878785",
    "sku": "351193AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET33 d66,6 BKM/FP Audi Q5 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 33.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-e474574abd47",
    "wheelId": "wheel-107192878785",
    "sku": "351199AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET35 d66,6 BK/FP Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 35.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-62cd1df7f9cb",
    "wheelId": "wheel-107192878785",
    "sku": "351200AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET35 d66,6 BKM Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 35.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-f305728fa939",
    "wheelId": "wheel-107192878785",
    "sku": "351201AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET35 d66,6 BKM/FP Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 35.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-093ee4c138ce",
    "wheelId": "wheel-107192878785",
    "sku": "351202AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*112 ET35 d66,6 BH Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 35.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-b16fd2018894",
    "wheelId": "wheel-111785217385",
    "sku": "78998",
    "fullName": "СКАД Premium КР008 (20BMW X7) 8,5\\R20 5*112 ET35 d66,6 Elite silver Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 35.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-0c2006a245f9",
    "wheelId": "wheel-111785217385",
    "sku": "79037",
    "fullName": "СКАД Premium КР008 (20BMW X7) 8,5\\R20 5*112 ET35 d66,6 Fury black Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×112",
    "et": 35.0,
    "dia": 66.6,
    "source": "BMW_X5_1.pdf",
    "sourceReferences": [
      "BMW_X5_1.pdf"
    ]
  },
  {
    "id": "sku-8c8d29eb79f2",
    "wheelId": "wheel-120901095121",
    "sku": "УТ000002608",
    "fullName": "Race Ready Technology CSSYA5640 8,5\\R19 5*108 ET45 d63,4 B-P/B",
    "width": 8.5,
    "diameter": 19.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.4,
    "source": "Geely_Atlas_1.pdf",
    "sourceReferences": [
      "Geely_Atlas_1.pdf",
      "zeekr_001_1.pdf"
    ]
  },
  {
    "id": "sku-b25ae4ebcef4",
    "wheelId": "wheel-124130035944",
    "sku": "УТС00009294",
    "fullName": "Race Ready Technology CSSYA2012 8,0\\R19 5*108 ET42 d63,4 BLK/M",
    "width": 8.0,
    "diameter": 19.0,
    "pcd": "5×108",
    "et": 42.0,
    "dia": 63.4,
    "source": "zeekr_001_1.pdf",
    "sourceReferences": [
      "zeekr_001_1.pdf"
    ]
  },
  {
    "id": "sku-63526ac89712",
    "wheelId": "wheel-85636297741",
    "sku": "20/63/10/36",
    "fullName": "Replica FR ZEEKR IVF-3166 8,5\\R21 5*108 ET40 d63,4 BM",
    "width": 8.5,
    "diameter": 21.0,
    "pcd": "5×108",
    "et": 40.0,
    "dia": 63.4,
    "source": "zeekr_001_2.pdf",
    "sourceReferences": [
      "zeekr_001_2.pdf"
    ]
  },
  {
    "id": "sku-065da36fb0f8",
    "wheelId": "wheel-120494859048",
    "sku": "4622648",
    "fullName": "СКАД Арика 8,0\\R19 5*108 ET45 d63,35 Алмаз бархат новый Fb max 950 kg",
    "width": 8.0,
    "diameter": 19.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.35,
    "source": "zeekr_001_1.pdf",
    "sourceReferences": [
      "zeekr_001_1.pdf"
    ]
  },
  {
    "id": "sku-84493082cd56",
    "wheelId": "wheel-126269312705",
    "sku": "83642",
    "fullName": "КиК Клермон (КС1156) 8,0\\R19 5*108 ET45 d63,35 Дарк платинум",
    "width": 8.0,
    "diameter": 19.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.35,
    "source": "Geely_Atlas_1.pdf",
    "sourceReferences": [
      "Geely_Atlas_1.pdf",
      "zeekr_001_1.pdf"
    ]
  },
  {
    "id": "sku-d420c9e23b20",
    "wheelId": "wheel-126269312705",
    "sku": "83674",
    "fullName": "КиК Клермон (КС1156) 8,0\\R19 5*108 ET45 d63,35 Алмаз черный",
    "width": 8.0,
    "diameter": 19.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.35,
    "source": "Geely_Atlas_1.pdf",
    "sourceReferences": [
      "Geely_Atlas_1.pdf",
      "zeekr_001_1.pdf"
    ]
  },
  {
    "id": "sku-f8698fdfcb6b",
    "wheelId": "wheel-115612627376",
    "sku": "4020722",
    "fullName": "СКАД Манчестер 7,5\\R19 5*108 ET45 d63,35 Бархат новый Fb max 750 kg",
    "width": 7.5,
    "diameter": 19.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.35,
    "source": "zeekr_001_1.pdf",
    "sourceReferences": [
      "zeekr_001_1.pdf"
    ]
  },
  {
    "id": "sku-d3ca96a8e8dc",
    "wheelId": "wheel-115612627376",
    "sku": "4020727",
    "fullName": "СКАД Манчестер 7,5\\R19 5*108 ET45 d63,35 Графит Fb max 750 kg",
    "width": 7.5,
    "diameter": 19.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.35,
    "source": "zeekr_001_1.pdf",
    "sourceReferences": [
      "zeekr_001_1.pdf"
    ]
  },
  {
    "id": "sku-94e78e411559",
    "wheelId": "wheel-115612627376",
    "sku": "4020748",
    "fullName": "СКАД Манчестер 7,5\\R19 5*108 ET45 d63,35 Алмаз-бархат Fb max 750 kg",
    "width": 7.5,
    "diameter": 19.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.35,
    "source": "zeekr_001_1.pdf",
    "sourceReferences": [
      "zeekr_001_1.pdf"
    ]
  },
  {
    "id": "sku-ced16bcf7372",
    "wheelId": "wheel-107192878785",
    "sku": "351167AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*108 ET46 d63,4 BK/FP Geely Tugella Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×108",
    "et": 46.0,
    "dia": 63.4,
    "source": "Geely_Atlas_2.pdf",
    "sourceReferences": [
      "Geely_Atlas_2.pdf"
    ]
  },
  {
    "id": "sku-1aa545c6b8fd",
    "wheelId": "wheel-109398879950",
    "sku": "79435",
    "fullName": "СКАД Premium КР014 (20Discovery Sport) 8,0\\R20 5*108 ET45 d63,35 Diamond quartz Fb max 840 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.35,
    "source": "Geely_Atlas_2.pdf",
    "sourceReferences": [
      "Geely_Atlas_2.pdf"
    ]
  },
  {
    "id": "sku-dd9c1500b4f1",
    "wheelId": "wheel-109398879950",
    "sku": "79461",
    "fullName": "СКАД Premium КР014 (20Discovery Sport) 8,0\\R20 5*108 ET45 d63,35 Fury black Fb max 840 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.35,
    "source": "Geely_Atlas_2.pdf",
    "sourceReferences": [
      "Geely_Atlas_2.pdf"
    ]
  },
  {
    "id": "sku-847f75252830",
    "wheelId": "wheel-109398879950",
    "sku": "79463",
    "fullName": "СКАД Premium КР014 (20Geely Tugella) 8,0\\R20 5*108 ET46 d63,35 Fury black Fb max 840 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×108",
    "et": 46.0,
    "dia": 63.35,
    "source": "Geely_Atlas_2.pdf",
    "sourceReferences": [
      "Geely_Atlas_2.pdf"
    ]
  },
  {
    "id": "sku-0fe0c261ccc6",
    "wheelId": "wheel-111785217385",
    "sku": "79040",
    "fullName": "СКАД Premium КР008 (20Velar) 8,5\\R20 5*108 ET45 d63,35 Fury black Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×108",
    "et": 45.0,
    "dia": 63.35,
    "source": "Geely_Atlas_2.pdf",
    "sourceReferences": [
      "Geely_Atlas_2.pdf"
    ]
  },
  {
    "id": "sku-974d4908e333",
    "wheelId": "wheel-118754944354",
    "sku": "29600BX",
    "fullName": "X'trike X-141 8,0\\R20 5*108 ET46 d63,35 BK Geely Tugella Fb max 820 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×108",
    "et": 46.0,
    "dia": 63.35,
    "source": "Geely_Atlas_2.pdf",
    "sourceReferences": [
      "Geely_Atlas_2.pdf"
    ]
  },
  {
    "id": "sku-258f94ebcd8e",
    "wheelId": "wheel-118754944354",
    "sku": "29699BX",
    "fullName": "X'trike X-141 8,0\\R20 5*108 ET48 d63,35 BK Fb max 820 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×108",
    "et": 48.0,
    "dia": 63.35,
    "source": "Geely_Atlas_2.pdf",
    "sourceReferences": [
      "Geely_Atlas_2.pdf"
    ]
  },
  {
    "id": "sku-966b927f66a6",
    "wheelId": "wheel-118754944354",
    "sku": "29699SX",
    "fullName": "X'trike X-141 8,0\\R20 5*108 ET48 d63,35 HSB Fb max 820 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×108",
    "et": 48.0,
    "dia": 63.35,
    "source": "Geely_Atlas_2.pdf",
    "sourceReferences": [
      "Geely_Atlas_2.pdf"
    ]
  },
  {
    "id": "sku-331222c92d4b",
    "wheelId": "wheel-123388297342",
    "sku": "20/63/10/31",
    "fullName": "Replica FR Lixiang IVF-3164 9,0\\R21 5*120 ET45,5 d62,5 BM",
    "width": 9.0,
    "diameter": 21.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_2.pdf",
    "sourceReferences": [
      "Li_L7_2.pdf"
    ]
  },
  {
    "id": "sku-efbcd0bb7a83",
    "wheelId": "wheel-107192878785",
    "sku": "351865AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*120 ET45,5 d62,5 BKM Li L7/L8 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-d1034d9d8ded",
    "wheelId": "wheel-107192878785",
    "sku": "351866AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*120 ET45,5 d62,5 BK/FP Li L7/L8 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-1915d3b47d80",
    "wheelId": "wheel-107192878785",
    "sku": "351867AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*120 ET45,5 d62,5 BKM/FP Li L7/L8 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-c68ef165fecf",
    "wheelId": "wheel-107192878785",
    "sku": "351868AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*120 ET45,5 d62,5 BH Li L7/L8 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-677705fdb1cf",
    "wheelId": "wheel-107192878785",
    "sku": "999505AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*120 ET45,5 d62,5 BK/FP Li L7/L8 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-1432a1774abf",
    "wheelId": "wheel-107192878785",
    "sku": "999507AZ",
    "fullName": "X'trike X-137 8,5\\R20 5*120 ET45,5 d62,5 BKM Li L7/L8 Fb max 960 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-7394881a0200",
    "wheelId": "wheel-120056032523",
    "sku": "KHW210108GRF",
    "fullName": "Khomen Wheels KHW2101 (Li 7/9) 9,5\\R21 5*120 ET45,5 d62,5 Gray-FP Fb max 950 kg",
    "width": 9.5,
    "diameter": 21.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_2.pdf",
    "sourceReferences": [
      "Li_L7_2.pdf"
    ]
  },
  {
    "id": "sku-b0b449240ee7",
    "wheelId": "wheel-120056032523",
    "sku": "KHW210108GRT",
    "fullName": "Khomen Wheels KHW2101 (Li 7/9) 9,5\\R21 5*120 ET45,5 d62,5 Gray Fb max 950 kg",
    "width": 9.5,
    "diameter": 21.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_2.pdf",
    "sourceReferences": [
      "Li_L7_2.pdf"
    ]
  },
  {
    "id": "sku-ba1932db0c83",
    "wheelId": "wheel-115592534608",
    "sku": "83290",
    "fullName": "СКАД Premium Kleemann (КР1067) 8,5\\R20 5*120 ET45,5 d62,5 Diamond quartz Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-d56ea7373ed2",
    "wheelId": "wheel-115592534608",
    "sku": "83291",
    "fullName": "СКАД Premium Kleemann (КР1067) 8,5\\R20 5*120 ET45,5 d62,5 Diamond gloss graphite Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-565394133a3b",
    "wheelId": "wheel-115592534608",
    "sku": "83293",
    "fullName": "СКАД Premium Kleemann (КР1067) 8,5\\R20 5*120 ET45,5 d62,5 Elite silver Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-7ae84bf5f78a",
    "wheelId": "wheel-115592534608",
    "sku": "83294",
    "fullName": "СКАД Premium Kleemann (КР1067) 8,5\\R20 5*120 ET45,5 d62,5 Fury black Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-4997f6e2bf84",
    "wheelId": "wheel-111785217385",
    "sku": "83296",
    "fullName": "СКАД Premium КР008 (20Li L7/Li L8) 8,5\\R20 5*120 ET45,5 d62,5 Elite silver Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-3bdb475c8ba1",
    "wheelId": "wheel-111785217385",
    "sku": "83297",
    "fullName": "СКАД Premium КР008 (20Li L7/Li L8) 8,5\\R20 5*120 ET45,5 d62,5 Fury black Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-4e508c3635d9",
    "wheelId": "wheel-111785217385",
    "sku": "83299",
    "fullName": "СКАД Premium КР008 (20Li L7/Li L8) 8,5\\R20 5*120 ET45,5 d62,5 Diamond quartz Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-9601f4bd4448",
    "wheelId": "wheel-111785217385",
    "sku": "83331",
    "fullName": "СКАД Premium КР008 (20Li L7/Li L8) 8,5\\R20 5*120 ET45,5 d62,5 Diamond gloss graphite Fb max 975 kg",
    "width": 8.5,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-69d96ae62b07",
    "wheelId": "wheel-118754944354",
    "sku": "14112AK",
    "fullName": "X'trike X-141 8,0\\R20 5*120 ET45,5 d62,5 BK/FP Li 7 до 2025 г.в. Fb max 820 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-275275e1f1ce",
    "wheelId": "wheel-118754944354",
    "sku": "14112GK",
    "fullName": "X'trike X-141 8,0\\R20 5*120 ET45,5 d62,5 HSB/FP Li 7 до 2025 г.в. Fb max 820 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-794ea6579241",
    "wheelId": "wheel-118754944354",
    "sku": "14112MK",
    "fullName": "X'trike X-141 8,0\\R20 5*120 ET45,5 d62,5 BKM Li 7 до 2025 г.в. Fb max 820 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-a53e920e86c9",
    "wheelId": "wheel-118754944354",
    "sku": "14112SK",
    "fullName": "X'trike X-141 8,0\\R20 5*120 ET45,5 d62,5 HS Li 7 до 2025 г.в. Fb max 820 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.5,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  },
  {
    "id": "sku-422ac893c5e7",
    "wheelId": "wheel-118754944354",
    "sku": "29612AX",
    "fullName": "X'trike X-141 8,0\\R20 5*120 ET45,5 d62,6 BK/FP Fb max 820 kg",
    "width": 8.0,
    "diameter": 20.0,
    "pcd": "5×120",
    "et": 45.5,
    "dia": 62.6,
    "source": "Li_L7_1.pdf",
    "sourceReferences": [
      "Li_L7_1.pdf"
    ]
  }
];

export const showcaseVariants: ShowcaseVariant[] = [
  {
    "id": "6c25143191fe3361",
    "vehicleId": "mercedes-gle",
    "wheelId": "wheel-104597021630",
    "skuIds": [
      "sku-97a737ed66a9"
    ],
    "image": {
      "src": "/assets/catalog/v1/mercedes-gle-6c25143191fe3361-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/mercedes-gle-6c25143191fe3361-640.webp 640w, /assets/catalog/v1/mercedes-gle-6c25143191fe3361-960.webp 960w, /assets/catalog/v1/mercedes-gle-6c25143191fe3361-1400.webp 1400w",
      "alt": "Mercedes-Benz GLE — LS Forged FG14"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "69c3d06a077c2edb",
    "vehicleId": "mercedes-gle",
    "wheelId": "wheel-125847429328",
    "skuIds": [
      "sku-7178795414ca"
    ],
    "image": {
      "src": "/assets/catalog/v1/mercedes-gle-69c3d06a077c2edb-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/mercedes-gle-69c3d06a077c2edb-640.webp 640w, /assets/catalog/v1/mercedes-gle-69c3d06a077c2edb-960.webp 960w, /assets/catalog/v1/mercedes-gle-69c3d06a077c2edb-1400.webp 1400w",
      "alt": "Mercedes-Benz GLE — КиК Элерон"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "bb44a79557571e02",
    "vehicleId": "mercedes-gle",
    "wheelId": "wheel-95044209621",
    "skuIds": [
      "sku-1077b81efbff",
      "sku-261e98a6caf7"
    ],
    "image": {
      "src": "/assets/catalog/v1/mercedes-gle-bb44a79557571e02-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/mercedes-gle-bb44a79557571e02-640.webp 640w, /assets/catalog/v1/mercedes-gle-bb44a79557571e02-960.webp 960w, /assets/catalog/v1/mercedes-gle-bb44a79557571e02-1400.webp 1400w",
      "alt": "Mercedes-Benz GLE — REPLAY MR208"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "4404966c99f14316",
    "vehicleId": "mercedes-gle",
    "wheelId": "wheel-107192878785",
    "skuIds": [
      "sku-99321f5e9742",
      "sku-6183a664c230",
      "sku-16ae08badc19",
      "sku-eab9edd28d50",
      "sku-2da5b9b375ce",
      "sku-3d01f641bfaa",
      "sku-992387d42c21"
    ],
    "image": {
      "src": "/assets/catalog/v1/mercedes-gle-4404966c99f14316-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/mercedes-gle-4404966c99f14316-640.webp 640w, /assets/catalog/v1/mercedes-gle-4404966c99f14316-960.webp 960w, /assets/catalog/v1/mercedes-gle-4404966c99f14316-1400.webp 1400w",
      "alt": "Mercedes-Benz GLE — X'trike X-137"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "a6cd3e5b9e54764c",
    "vehicleId": "mercedes-gle",
    "wheelId": "wheel-100987003598",
    "skuIds": [
      "sku-3c39d2ffb5cf"
    ],
    "image": {
      "src": "/assets/catalog/v1/mercedes-gle-a6cd3e5b9e54764c-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/mercedes-gle-a6cd3e5b9e54764c-640.webp 640w, /assets/catalog/v1/mercedes-gle-a6cd3e5b9e54764c-960.webp 960w, /assets/catalog/v1/mercedes-gle-a6cd3e5b9e54764c-1400.webp 1400w",
      "alt": "Mercedes-Benz GLE — LS FlowForming RC55"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "45cbda6ba70dbdff",
    "vehicleId": "mercedes-gle",
    "wheelId": "wheel-109398868737",
    "skuIds": [
      "sku-481536945a42"
    ],
    "image": {
      "src": "/assets/catalog/v1/mercedes-gle-45cbda6ba70dbdff-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/mercedes-gle-45cbda6ba70dbdff-640.webp 640w, /assets/catalog/v1/mercedes-gle-45cbda6ba70dbdff-960.webp 960w, /assets/catalog/v1/mercedes-gle-45cbda6ba70dbdff-1400.webp 1400w",
      "alt": "Mercedes-Benz GLE — СКАД Premium КР014"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "5b95efe8197c5699",
    "vehicleId": "bmw-x5",
    "wheelId": "wheel-100309984417",
    "skuIds": [
      "sku-484b58b8790a"
    ],
    "image": {
      "src": "/assets/catalog/v1/bmw-x5-5b95efe8197c5699-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/bmw-x5-5b95efe8197c5699-640.webp 640w, /assets/catalog/v1/bmw-x5-5b95efe8197c5699-960.webp 960w, /assets/catalog/v1/bmw-x5-5b95efe8197c5699-1400.webp 1400w",
      "alt": "BMW X5 — Replica FR BMW B495"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "18c8e2d60950a73c",
    "vehicleId": "bmw-x5",
    "wheelId": "wheel-106265943070",
    "skuIds": [
      "sku-2f597dcf3edd"
    ],
    "image": {
      "src": "/assets/catalog/v1/bmw-x5-18c8e2d60950a73c-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/bmw-x5-18c8e2d60950a73c-640.webp 640w, /assets/catalog/v1/bmw-x5-18c8e2d60950a73c-960.webp 960w, /assets/catalog/v1/bmw-x5-18c8e2d60950a73c-1400.webp 1400w",
      "alt": "BMW X5 — LS Forged FG05"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "34e08c0bff943b64",
    "vehicleId": "bmw-x5",
    "wheelId": "wheel-123881154785",
    "skuIds": [
      "sku-234d4bf5e142"
    ],
    "image": {
      "src": "/assets/catalog/v1/bmw-x5-34e08c0bff943b64-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/bmw-x5-34e08c0bff943b64-640.webp 640w, /assets/catalog/v1/bmw-x5-34e08c0bff943b64-960.webp 960w, /assets/catalog/v1/bmw-x5-34e08c0bff943b64-1400.webp 1400w",
      "alt": "BMW X5 — RST R2204FF"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "0984b073fe9f162e",
    "vehicleId": "bmw-x5",
    "wheelId": "wheel-88731778597",
    "skuIds": [
      "sku-c561a5bf193c"
    ],
    "image": {
      "src": "/assets/catalog/v1/bmw-x5-0984b073fe9f162e-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/bmw-x5-0984b073fe9f162e-640.webp 640w, /assets/catalog/v1/bmw-x5-0984b073fe9f162e-960.webp 960w, /assets/catalog/v1/bmw-x5-0984b073fe9f162e-1400.webp 1400w",
      "alt": "BMW X5 — LEGE ARTIS Concept-B531"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "844bf41bac0cd36b",
    "vehicleId": "bmw-x5",
    "wheelId": "wheel-107192878785",
    "skuIds": [
      "sku-fdb469605bb2",
      "sku-001cf622fd7a",
      "sku-2d3d0e7df5f5",
      "sku-ea51d3e7138f",
      "sku-783f5b8f5412",
      "sku-7b42f92bf243",
      "sku-e474574abd47",
      "sku-62cd1df7f9cb",
      "sku-f305728fa939",
      "sku-093ee4c138ce"
    ],
    "image": {
      "src": "/assets/catalog/v1/bmw-x5-844bf41bac0cd36b-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/bmw-x5-844bf41bac0cd36b-640.webp 640w, /assets/catalog/v1/bmw-x5-844bf41bac0cd36b-960.webp 960w, /assets/catalog/v1/bmw-x5-844bf41bac0cd36b-1400.webp 1400w",
      "alt": "BMW X5 — X'trike X-137"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "5c5d69ee83aa2580",
    "vehicleId": "bmw-x5",
    "wheelId": "wheel-111785217385",
    "skuIds": [
      "sku-b16fd2018894",
      "sku-0c2006a245f9"
    ],
    "image": {
      "src": "/assets/catalog/v1/bmw-x5-5c5d69ee83aa2580-1400.webp",
      "width": 1400,
      "height": 933,
      "srcSet": "/assets/catalog/v1/bmw-x5-5c5d69ee83aa2580-640.webp 640w, /assets/catalog/v1/bmw-x5-5c5d69ee83aa2580-960.webp 960w, /assets/catalog/v1/bmw-x5-5c5d69ee83aa2580-1400.webp 1400w",
      "alt": "BMW X5 — СКАД Premium КР008"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "e79497f343ce213d",
    "vehicleId": "zeekr-001",
    "wheelId": "wheel-120901095121",
    "skuIds": [
      "sku-8c8d29eb79f2"
    ],
    "image": {
      "src": "/assets/catalog/v1/zeekr-001-e79497f343ce213d-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/zeekr-001-e79497f343ce213d-640.webp 640w, /assets/catalog/v1/zeekr-001-e79497f343ce213d-960.webp 960w, /assets/catalog/v1/zeekr-001-e79497f343ce213d-1536.webp 1536w",
      "alt": "Zeekr 001 — Race Ready Technology CSSYA5640"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "6b4714790a426f76",
    "vehicleId": "zeekr-001",
    "wheelId": "wheel-124130035944",
    "skuIds": [
      "sku-b25ae4ebcef4"
    ],
    "image": {
      "src": "/assets/catalog/v1/zeekr-001-6b4714790a426f76-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/zeekr-001-6b4714790a426f76-640.webp 640w, /assets/catalog/v1/zeekr-001-6b4714790a426f76-960.webp 960w, /assets/catalog/v1/zeekr-001-6b4714790a426f76-1536.webp 1536w",
      "alt": "Zeekr 001 — Race Ready Technology CSSYA2012"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "d3bfd8485ae2b070",
    "vehicleId": "zeekr-001",
    "wheelId": "wheel-85636297741",
    "skuIds": [
      "sku-63526ac89712"
    ],
    "image": {
      "src": "/assets/catalog/v1/zeekr-001-d3bfd8485ae2b070-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/zeekr-001-d3bfd8485ae2b070-640.webp 640w, /assets/catalog/v1/zeekr-001-d3bfd8485ae2b070-960.webp 960w, /assets/catalog/v1/zeekr-001-d3bfd8485ae2b070-1536.webp 1536w",
      "alt": "Zeekr 001 — Replica FR ZEEKR IVF-3166"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "5183c31f51b0b709",
    "vehicleId": "zeekr-001",
    "wheelId": "wheel-120494859048",
    "skuIds": [
      "sku-065da36fb0f8"
    ],
    "image": {
      "src": "/assets/catalog/v1/zeekr-001-5183c31f51b0b709-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/zeekr-001-5183c31f51b0b709-640.webp 640w, /assets/catalog/v1/zeekr-001-5183c31f51b0b709-960.webp 960w, /assets/catalog/v1/zeekr-001-5183c31f51b0b709-1536.webp 1536w",
      "alt": "Zeekr 001 — СКАД Арика"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "1993fa7d694e7934",
    "vehicleId": "zeekr-001",
    "wheelId": "wheel-126269312705",
    "skuIds": [
      "sku-84493082cd56",
      "sku-d420c9e23b20"
    ],
    "image": {
      "src": "/assets/catalog/v1/zeekr-001-1993fa7d694e7934-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/zeekr-001-1993fa7d694e7934-640.webp 640w, /assets/catalog/v1/zeekr-001-1993fa7d694e7934-960.webp 960w, /assets/catalog/v1/zeekr-001-1993fa7d694e7934-1536.webp 1536w",
      "alt": "Zeekr 001 — КиК Клермон"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "484cacf8a40572d3",
    "vehicleId": "zeekr-001",
    "wheelId": "wheel-115612627376",
    "skuIds": [
      "sku-f8698fdfcb6b",
      "sku-d3ca96a8e8dc",
      "sku-94e78e411559"
    ],
    "image": {
      "src": "/assets/catalog/v1/zeekr-001-484cacf8a40572d3-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/zeekr-001-484cacf8a40572d3-640.webp 640w, /assets/catalog/v1/zeekr-001-484cacf8a40572d3-960.webp 960w, /assets/catalog/v1/zeekr-001-484cacf8a40572d3-1536.webp 1536w",
      "alt": "Zeekr 001 — СКАД Манчестер"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "792ca136780ef83e",
    "vehicleId": "geely-cityray",
    "wheelId": "wheel-107192878785",
    "skuIds": [
      "sku-ced16bcf7372"
    ],
    "image": {
      "src": "/assets/catalog/v1/geely-cityray-792ca136780ef83e-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/geely-cityray-792ca136780ef83e-640.webp 640w, /assets/catalog/v1/geely-cityray-792ca136780ef83e-960.webp 960w, /assets/catalog/v1/geely-cityray-792ca136780ef83e-1536.webp 1536w",
      "alt": "Geely Atlas — X'trike X-137"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "e1f6708ea2835f8b",
    "vehicleId": "geely-cityray",
    "wheelId": "wheel-120901095121",
    "skuIds": [
      "sku-8c8d29eb79f2"
    ],
    "image": {
      "src": "/assets/catalog/v1/geely-cityray-e1f6708ea2835f8b-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/geely-cityray-e1f6708ea2835f8b-640.webp 640w, /assets/catalog/v1/geely-cityray-e1f6708ea2835f8b-960.webp 960w, /assets/catalog/v1/geely-cityray-e1f6708ea2835f8b-1536.webp 1536w",
      "alt": "Geely Atlas — Race Ready Technology CSSYA5640"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "33238df57cd1b3f1",
    "vehicleId": "geely-cityray",
    "wheelId": "wheel-109398879950",
    "skuIds": [
      "sku-1aa545c6b8fd",
      "sku-dd9c1500b4f1",
      "sku-847f75252830"
    ],
    "image": {
      "src": "/assets/catalog/v1/geely-cityray-33238df57cd1b3f1-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/geely-cityray-33238df57cd1b3f1-640.webp 640w, /assets/catalog/v1/geely-cityray-33238df57cd1b3f1-960.webp 960w, /assets/catalog/v1/geely-cityray-33238df57cd1b3f1-1536.webp 1536w",
      "alt": "Geely Atlas — СКАД Premium КР014"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "4f647170520a9719",
    "vehicleId": "geely-cityray",
    "wheelId": "wheel-126269312705",
    "skuIds": [
      "sku-84493082cd56",
      "sku-d420c9e23b20"
    ],
    "image": {
      "src": "/assets/catalog/v1/geely-cityray-4f647170520a9719-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/geely-cityray-4f647170520a9719-640.webp 640w, /assets/catalog/v1/geely-cityray-4f647170520a9719-960.webp 960w, /assets/catalog/v1/geely-cityray-4f647170520a9719-1536.webp 1536w",
      "alt": "Geely Atlas — КиК Клермон"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "b53d7182a9c91b96",
    "vehicleId": "geely-cityray",
    "wheelId": "wheel-111785217385",
    "skuIds": [
      "sku-0fe0c261ccc6"
    ],
    "image": {
      "src": "/assets/catalog/v1/geely-cityray-b53d7182a9c91b96-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/geely-cityray-b53d7182a9c91b96-640.webp 640w, /assets/catalog/v1/geely-cityray-b53d7182a9c91b96-960.webp 960w, /assets/catalog/v1/geely-cityray-b53d7182a9c91b96-1536.webp 1536w",
      "alt": "Geely Atlas — СКАД Premium КР008"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "ac25fca85a337721",
    "vehicleId": "geely-cityray",
    "wheelId": "wheel-118754944354",
    "skuIds": [
      "sku-974d4908e333",
      "sku-258f94ebcd8e",
      "sku-966b927f66a6"
    ],
    "image": {
      "src": "/assets/catalog/v1/geely-cityray-ac25fca85a337721-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/geely-cityray-ac25fca85a337721-640.webp 640w, /assets/catalog/v1/geely-cityray-ac25fca85a337721-960.webp 960w, /assets/catalog/v1/geely-cityray-ac25fca85a337721-1536.webp 1536w",
      "alt": "Geely Atlas — X'trike X-141"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "84f83169b354f651",
    "vehicleId": "li-auto-l7",
    "wheelId": "wheel-123388297342",
    "skuIds": [
      "sku-331222c92d4b"
    ],
    "image": {
      "src": "/assets/catalog/v1/li-auto-l7-84f83169b354f651-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/li-auto-l7-84f83169b354f651-640.webp 640w, /assets/catalog/v1/li-auto-l7-84f83169b354f651-960.webp 960w, /assets/catalog/v1/li-auto-l7-84f83169b354f651-1536.webp 1536w",
      "alt": "Li Auto L7 — Replica FR Lixiang IVF-3164"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "847ad5c7512b9692",
    "vehicleId": "li-auto-l7",
    "wheelId": "wheel-107192878785",
    "skuIds": [
      "sku-efbcd0bb7a83",
      "sku-d1034d9d8ded",
      "sku-1915d3b47d80",
      "sku-c68ef165fecf",
      "sku-677705fdb1cf",
      "sku-1432a1774abf"
    ],
    "image": {
      "src": "/assets/catalog/v1/li-auto-l7-847ad5c7512b9692-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/li-auto-l7-847ad5c7512b9692-640.webp 640w, /assets/catalog/v1/li-auto-l7-847ad5c7512b9692-960.webp 960w, /assets/catalog/v1/li-auto-l7-847ad5c7512b9692-1536.webp 1536w",
      "alt": "Li Auto L7 — X'trike X-137"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "490c7bd1dfdfd15a",
    "vehicleId": "li-auto-l7",
    "wheelId": "wheel-120056032523",
    "skuIds": [
      "sku-7394881a0200",
      "sku-b0b449240ee7"
    ],
    "image": {
      "src": "/assets/catalog/v1/li-auto-l7-490c7bd1dfdfd15a-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/li-auto-l7-490c7bd1dfdfd15a-640.webp 640w, /assets/catalog/v1/li-auto-l7-490c7bd1dfdfd15a-960.webp 960w, /assets/catalog/v1/li-auto-l7-490c7bd1dfdfd15a-1536.webp 1536w",
      "alt": "Li Auto L7 — Khomen Wheels KHW2101"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "585f724620226cd5",
    "vehicleId": "li-auto-l7",
    "wheelId": "wheel-115592534608",
    "skuIds": [
      "sku-ba1932db0c83",
      "sku-d56ea7373ed2",
      "sku-565394133a3b",
      "sku-7ae84bf5f78a"
    ],
    "image": {
      "src": "/assets/catalog/v1/li-auto-l7-585f724620226cd5-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/li-auto-l7-585f724620226cd5-640.webp 640w, /assets/catalog/v1/li-auto-l7-585f724620226cd5-960.webp 960w, /assets/catalog/v1/li-auto-l7-585f724620226cd5-1536.webp 1536w",
      "alt": "Li Auto L7 — СКАД Premium Kleemann"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "bae933d8afad6839",
    "vehicleId": "li-auto-l7",
    "wheelId": "wheel-111785217385",
    "skuIds": [
      "sku-4997f6e2bf84",
      "sku-3bdb475c8ba1",
      "sku-4e508c3635d9",
      "sku-9601f4bd4448"
    ],
    "image": {
      "src": "/assets/catalog/v1/li-auto-l7-bae933d8afad6839-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/li-auto-l7-bae933d8afad6839-640.webp 640w, /assets/catalog/v1/li-auto-l7-bae933d8afad6839-960.webp 960w, /assets/catalog/v1/li-auto-l7-bae933d8afad6839-1536.webp 1536w",
      "alt": "Li Auto L7 — СКАД Premium КР008"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  },
  {
    "id": "6d5b0b6e3263654a",
    "vehicleId": "li-auto-l7",
    "wheelId": "wheel-118754944354",
    "skuIds": [
      "sku-69d96ae62b07",
      "sku-275275e1f1ce",
      "sku-794ea6579241",
      "sku-a53e920e86c9",
      "sku-422ac893c5e7"
    ],
    "image": {
      "src": "/assets/catalog/v1/li-auto-l7-6d5b0b6e3263654a-1536.webp",
      "width": 1536,
      "height": 1024,
      "srcSet": "/assets/catalog/v1/li-auto-l7-6d5b0b6e3263654a-640.webp 640w, /assets/catalog/v1/li-auto-l7-6d5b0b6e3263654a-960.webp 960w, /assets/catalog/v1/li-auto-l7-6d5b0b6e3263654a-1536.webp 1536w",
      "alt": "Li Auto L7 — X'trike X-141"
    },
    "compatibility": {
      "status": "unknown",
      "sourceReference": "selected-wheel-workbook-v1"
    },
    "isMock": false,
    "isGenerated": true
  }
];

export const getVehicle = (id: string) => vehicles.find((vehicle) => vehicle.id === id);
export const getWheel = (id: string) => wheels.find((wheel) => wheel.id === id);
export const getWheelSku = (id: string) => wheelSkus.find((sku) => sku.id === id);
export const getVariantsForVehicle = (vehicleId: string) => showcaseVariants.filter((variant) => variant.vehicleId === vehicleId);
export const getVariant = (vehicleId: string, wheelId: string) => showcaseVariants.find((variant) => variant.vehicleId === vehicleId && variant.wheelId === wheelId);
