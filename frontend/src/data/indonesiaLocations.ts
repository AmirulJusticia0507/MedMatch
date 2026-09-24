export interface IndonesiaLocation {
  city: string;
  province: string;
  latitude: number;
  longitude: number;
}

export const indonesiaLocations: IndonesiaLocation[] = [
  { city: "Banda Aceh", province: "Aceh", latitude: 5.5483, longitude: 95.3238 },
  { city: "Medan", province: "Sumatera Utara", latitude: 3.5952, longitude: 98.6722 },
  { city: "Padang", province: "Sumatera Barat", latitude: -0.9471, longitude: 100.4172 },
  { city: "Pekanbaru", province: "Riau", latitude: 0.5071, longitude: 101.4478 },
  { city: "Tanjung Pinang", province: "Kepulauan Riau", latitude: 0.9186, longitude: 104.4665 },
  { city: "Jambi", province: "Jambi", latitude: -1.6101, longitude: 103.6131 },
  { city: "Palembang", province: "Sumatera Selatan", latitude: -2.9761, longitude: 104.7754 },
  { city: "Pangkal Pinang", province: "Kepulauan Bangka Belitung", latitude: -2.1316, longitude: 106.1169 },
  { city: "Bengkulu", province: "Bengkulu", latitude: -3.7928, longitude: 102.2608 },
  { city: "Bandar Lampung", province: "Lampung", latitude: -5.3971, longitude: 105.2668 },
  { city: "Jakarta Pusat", province: "DKI Jakarta", latitude: -6.1754, longitude: 106.8272 },
  { city: "Serang", province: "Banten", latitude: -6.1201, longitude: 106.1503 },
  { city: "Bandung", province: "Jawa Barat", latitude: -6.9175, longitude: 107.6191 },
  { city: "Semarang", province: "Jawa Tengah", latitude: -6.9667, longitude: 110.4167 },
  { city: "Yogyakarta", province: "DI Yogyakarta", latitude: -7.7956, longitude: 110.3695 },
  { city: "Surabaya", province: "Jawa Timur", latitude: -7.2575, longitude: 112.7521 },
  { city: "Denpasar", province: "Bali", latitude: -8.6705, longitude: 115.2126 },
  { city: "Mataram", province: "Nusa Tenggara Barat", latitude: -8.5833, longitude: 116.1167 },
  { city: "Kupang", province: "Nusa Tenggara Timur", latitude: -10.1772, longitude: 123.607 },
  { city: "Pontianak", province: "Kalimantan Barat", latitude: -0.0263, longitude: 109.3425 },
  { city: "Palangka Raya", province: "Kalimantan Tengah", latitude: -2.2161, longitude: 113.9137 },
  { city: "Banjarmasin", province: "Kalimantan Selatan", latitude: -3.3186, longitude: 114.5944 },
  { city: "Samarinda", province: "Kalimantan Timur", latitude: -0.5022, longitude: 117.1536 },
  { city: "Tanjung Selor", province: "Kalimantan Utara", latitude: 2.8375, longitude: 117.3653 },
  { city: "Manado", province: "Sulawesi Utara", latitude: 1.4748, longitude: 124.8421 },
  { city: "Gorontalo", province: "Gorontalo", latitude: 0.5435, longitude: 123.0568 },
  { city: "Palu", province: "Sulawesi Tengah", latitude: -0.8986, longitude: 119.8506 },
  { city: "Mamuju", province: "Sulawesi Barat", latitude: -2.6806, longitude: 118.8867 },
  { city: "Makassar", province: "Sulawesi Selatan", latitude: -5.1477, longitude: 119.4327 },
  { city: "Kendari", province: "Sulawesi Tenggara", latitude: -3.9985, longitude: 122.512 },
  { city: "Ambon", province: "Maluku", latitude: -3.6954, longitude: 128.1814 },
  { city: "Sofifi", province: "Maluku Utara", latitude: 0.7373, longitude: 127.5588 },
  { city: "Manokwari", province: "Papua Barat", latitude: -0.8615, longitude: 134.062 },
  { city: "Sorong", province: "Papua Barat Daya", latitude: -0.8762, longitude: 131.2558 },
  { city: "Jayapura", province: "Papua", latitude: -2.5916, longitude: 140.669 },
  { city: "Nabire", province: "Papua Tengah", latitude: -3.3667, longitude: 135.4833 },
  { city: "Wamena", province: "Papua Pegunungan", latitude: -4.095, longitude: 138.9469 },
  { city: "Merauke", province: "Papua Selatan", latitude: -8.4932, longitude: 140.4018 }
];

export function getLocationLabel(location: IndonesiaLocation): string {
  return `${location.city}, ${location.province}`;
}
