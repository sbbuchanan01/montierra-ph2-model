/** Rent & tax comp reference tables (documentation inputs — not wired into the engine). */

export interface RentComp {
  map: number;
  name: string;
  address: string;
  vintage: number;
  units: number;
  avgSf: number;
  effRent: number;
  occ: number;
  distanceMi: number | string;
  ceiling?: string;
  upgraded: string;
  note?: string;
}

export const SUBJECT_COMP = {
  name: 'Montierra Ph. II (Subject)',
  address: '413 Lion Dr',
  vintage: 2009,
  units: 20,
  avgSf: 1000,
  occ: 0.95,
  ceiling: "8'",
  upgraded: 'Yes',
};

export const RENT_COMPS: RentComp[] = [
  { map: 1, name: 'The Courtyard', address: '215 S Rock St', vintage: 2017, units: 12, avgSf: 1039, effRent: 1702, occ: 0.927, distanceMi: 11, ceiling: "8' / 9'", upgraded: 'No' },
  { map: 2, name: 'Horseshoe Apartments', address: '501 Horseshoe Dr', vintage: 2023, units: 50, avgSf: 790, effRent: 1255, occ: 0.9, distanceMi: 0.1, ceiling: "9'", upgraded: 'No' },
  { map: 3, name: 'Chisholm Trail Condo', address: '2215 Dry Creek Dr', vintage: 2003, units: 30, avgSf: 1052, effRent: 1845, occ: 0.967, distanceMi: 11.4, ceiling: "8'", upgraded: 'No' },
  { map: 4, name: 'Stubblefield Park', address: '304 Stubblefield Ln', vintage: 2016, units: 54, avgSf: 885, effRent: 1516, occ: 0.97, distanceMi: 7.2, ceiling: "8'", upgraded: 'No', note: 'Bay Mngt took over 1/1/26; no W/D' },
  { map: 5, name: 'Dalewood Townhomes', address: '9601 Dalewood Dr', vintage: 1986, units: 50, avgSf: 1089, effRent: 1769, occ: 0.92, distanceMi: 8.9, ceiling: "9'", upgraded: 'No' },
  { map: 6, name: 'New Village Townhomes', address: '705 Apache Trl', vintage: 2019, units: 20, avgSf: 1086, effRent: 1662, occ: 1, distanceMi: 1.5, ceiling: "9'", upgraded: 'No' },
  { map: 7, name: 'Westwood Townhomes', address: '200 Riverbend Drive', vintage: 1997, units: 110, avgSf: 1179, effRent: 1455, occ: 0.79, distanceMi: 12, ceiling: "8'", upgraded: 'No' },
  { map: 8, name: 'The Powell', address: '523 Powell Dr', vintage: 2023, units: 96, avgSf: 1086, effRent: 1584, occ: 0.74, distanceMi: 0.2, ceiling: "8' / 10'", upgraded: 'No' },
];

export const CLASS_A_COMPS: RentComp[] = [
  { map: 1, name: 'Verena at Leander', address: '11350 Hero Way W', vintage: 2017, units: 156, avgSf: 773, effRent: 3734, occ: 0.75, distanceMi: 0.69, upgraded: 'No' },
  { map: 2, name: 'The Standard at Leander Station', address: '1680 Hero Way', vintage: 2016, units: 225, avgSf: 936, effRent: 1481, occ: 0.85, distanceMi: 1.02, upgraded: 'No' },
  { map: 3, name: 'Leander Park', address: '14801 Ronald W Reagan Blvd', vintage: 2020, units: 288, avgSf: 764, effRent: 1161, occ: 0.95, distanceMi: 3.7, upgraded: 'No' },
  { map: 4, name: 'Leander Station', address: '11450 Old 2243 W', vintage: 2011, units: 192, avgSf: 908, effRent: 1344, occ: 0.94, distanceMi: 0.75, upgraded: 'No' },
  { map: 5, name: 'The Chloe', address: '348 Main St', vintage: 2022, units: 276, avgSf: 892, effRent: 1273, occ: 0.89, distanceMi: 0.93, upgraded: 'No' },
  { map: 6, name: 'Trailside Oaks Townhomes', address: '680 Naumann Dr', vintage: 2020, units: 105, avgSf: 1234, effRent: 1747, occ: 0.85, distanceMi: 1.12, upgraded: 'No' },
  { map: 7, name: 'Lakeline Apartments', address: '3000 N Lakeline Blvd', vintage: 2002, units: 264, avgSf: 1001, effRent: 1233, occ: 0.84, distanceMi: 2.65, upgraded: 'No' },
  { map: 8, name: 'Merritt Legacy', address: '1350 Sonny Dr', vintage: 2014, units: 208, avgSf: 1021, effRent: 1165, occ: 0.9, distanceMi: 1.08, upgraded: 'No' },
  { map: 9, name: 'Tuckaway Apartment Homes', address: '1700 Bagdad Rd', vintage: 2017, units: 256, avgSf: 1027, effRent: 984, occ: 0.68, distanceMi: 3.28, upgraded: 'No' },
];

/** Tax comps sheet (template placeholder values, kept as documentation). */
export const TAX_COMPS = [
  { name: 'Property Name 1', units: 370, avgSf: 800, assessedValue: 75_000_000 },
  { name: 'Property Name 2', units: 350, avgSf: 750, assessedValue: 75_000_000 },
  { name: 'Property Name 3', units: 325, avgSf: 670, assessedValue: 75_000_000 },
  { name: 'Property Name 4', units: 275, avgSf: 900, assessedValue: 75_000_000 },
  { name: 'Property Name 5', units: 260, avgSf: 925, assessedValue: 75_000_000 },
];
