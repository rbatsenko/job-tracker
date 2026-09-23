export type Country = { code: string; name: string; eu: boolean; hints?: string[] };

/** `eu` covers EU, EEA and Switzerland — "can I work there from Europe". */
export const COUNTRIES: Country[] = [
  { code: "at", name: "Austria", eu: true, hints: ["vienna"] },
  { code: "be", name: "Belgium", eu: true, hints: ["brussels"] },
  { code: "bg", name: "Bulgaria", eu: true, hints: ["sofia"] },
  { code: "hr", name: "Croatia", eu: true, hints: ["zagreb"] },
  { code: "cy", name: "Cyprus", eu: true },
  { code: "cz", name: "Czechia", eu: true, hints: ["czech", "prague", "praha", "brno"] },
  { code: "dk", name: "Denmark", eu: true, hints: ["copenhagen", "aarhus", "fredericia"] },
  { code: "ee", name: "Estonia", eu: true, hints: ["tallinn"] },
  { code: "fi", name: "Finland", eu: true, hints: ["helsinki"] },
  { code: "fr", name: "France", eu: true, hints: ["paris", "lyon", "toulouse"] },
  { code: "de", name: "Germany", eu: true, hints: ["berlin", "munich", "münchen", "hamburg", "cologne", "frankfurt"] },
  { code: "gr", name: "Greece", eu: true, hints: ["athens"] },
  { code: "hu", name: "Hungary", eu: true, hints: ["budapest"] },
  { code: "ie", name: "Ireland", eu: true, hints: ["dublin"] },
  { code: "it", name: "Italy", eu: true, hints: ["milan", "milano", "rome", "roma", "turin"] },
  { code: "lv", name: "Latvia", eu: true, hints: ["riga"] },
  { code: "lt", name: "Lithuania", eu: true, hints: ["vilnius"] },
  { code: "lu", name: "Luxembourg", eu: true },
  { code: "mt", name: "Malta", eu: true },
  { code: "nl", name: "Netherlands", eu: true, hints: ["amsterdam", "rotterdam", "utrecht", "holland"] },
  { code: "no", name: "Norway", eu: true, hints: ["oslo"] },
  { code: "pl", name: "Poland", eu: true, hints: ["polska", "warsaw", "warszawa", "krakow", "kraków", "krak", "wroclaw", "wrocław", "gdansk", "gdańsk", "poznan", "poznań", "katowice", "lodz", "łódź"] },
  { code: "pt", name: "Portugal", eu: true, hints: ["lisbon", "lisboa", "porto"] },
  { code: "ro", name: "Romania", eu: true, hints: ["bucharest", "cluj"] },
  { code: "sk", name: "Slovakia", eu: true, hints: ["bratislava"] },
  { code: "si", name: "Slovenia", eu: true, hints: ["ljubljana"] },
  { code: "es", name: "Spain", eu: true, hints: ["madrid", "barcelona", "valencia"] },
  { code: "se", name: "Sweden", eu: true, hints: ["stockholm", "gothenburg"] },
  { code: "is", name: "Iceland", eu: true, hints: ["reykjavik"] },
  { code: "ch", name: "Switzerland", eu: true, hints: ["zurich", "zürich", "geneva", "lausanne", "basel"] },
  { code: "gb", name: "United Kingdom", eu: false, hints: ["uk", "england", "scotland", "wales", "london", "manchester", "edinburgh", "britain"] },
  { code: "ua", name: "Ukraine", eu: false, hints: ["kyiv", "kiev", "lviv"] },
  { code: "rs", name: "Serbia", eu: false, hints: ["belgrade"] },
  { code: "tr", name: "Türkiye", eu: false, hints: ["turkey", "istanbul", "ankara"] },
  { code: "us", name: "United States", eu: false, hints: ["usa", "u.s.", "united states"] },
  { code: "ca", name: "Canada", eu: false, hints: ["toronto", "vancouver", "montreal", "calgary"] },
  { code: "mx", name: "Mexico", eu: false, hints: ["mexico city"] },
  { code: "br", name: "Brazil", eu: false, hints: ["brasil", "sao paulo", "são paulo"] },
  { code: "ar", name: "Argentina", eu: false, hints: ["buenos aires"] },
  { code: "co", name: "Colombia", eu: false, hints: ["bogota", "bogotá"] },
  { code: "cl", name: "Chile", eu: false, hints: ["santiago"] },
  { code: "pe", name: "Peru", eu: false, hints: ["lima"] },
  { code: "za", name: "South Africa", eu: false, hints: ["cape town", "johannesburg"] },
  { code: "ng", name: "Nigeria", eu: false, hints: ["lagos"] },
  { code: "ke", name: "Kenya", eu: false, hints: ["nairobi"] },
  { code: "eg", name: "Egypt", eu: false, hints: ["cairo"] },
  { code: "ae", name: "United Arab Emirates", eu: false, hints: ["dubai", "abu dhabi"] },
  { code: "sa", name: "Saudi Arabia", eu: false, hints: ["riyadh"] },
  { code: "il", name: "Israel", eu: false, hints: ["tel aviv"] },
  { code: "in", name: "India", eu: false, hints: ["bengaluru", "bangalore", "mumbai", "delhi", "pune", "hyderabad"] },
  { code: "pk", name: "Pakistan", eu: false, hints: ["karachi", "lahore"] },
  { code: "id", name: "Indonesia", eu: false, hints: ["jakarta"] },
  { code: "ph", name: "Philippines", eu: false, hints: ["manila"] },
  { code: "vn", name: "Vietnam", eu: false, hints: ["hanoi", "ho chi minh"] },
  { code: "th", name: "Thailand", eu: false, hints: ["bangkok"] },
  { code: "my", name: "Malaysia", eu: false, hints: ["kuala lumpur"] },
  { code: "sg", name: "Singapore", eu: false },
  { code: "jp", name: "Japan", eu: false, hints: ["tokyo"] },
  { code: "kr", name: "South Korea", eu: false, hints: ["seoul"] },
  { code: "cn", name: "China", eu: false, hints: ["beijing", "shanghai", "shenzhen"] },
  { code: "tw", name: "Taiwan", eu: false, hints: ["taipei"] },
  { code: "au", name: "Australia", eu: false, hints: ["sydney", "melbourne", "brisbane"] },
  { code: "nz", name: "New Zealand", eu: false, hints: ["auckland", "wellington"] },
];

export const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
export const EU_CODES = new Set(COUNTRIES.filter((c) => c.eu).map((c) => c.code));

export const countryName = (code: string) => BY_CODE.get(code)?.name ?? code.toUpperCase();

export const COUNTRY_OPTIONS = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Finds a country by name or city. Bare codes only count uppercase and in short
 * strings, otherwise IT, NO, IS, BE and AT match ordinary English words.
 */
export function detectCountry(text: string): string | null {
  const lower = text.toLowerCase();

  for (const c of COUNTRIES) {
    if (new RegExp(`\\b${c.name.toLowerCase()}\\b`).test(lower)) return c.code;
    for (const h of c.hints ?? []) {
      if (new RegExp(`\\b${h}\\b`).test(lower)) return c.code;
    }
  }
  if (text.length <= 70) {
    for (const c of COUNTRIES) {
      if (new RegExp(`\\b${c.code.toUpperCase()}\\b`).test(text)) return c.code;
    }
  }
  return null;
}
