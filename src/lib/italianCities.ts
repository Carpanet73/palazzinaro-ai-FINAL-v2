// CORREZIONE AA — Elenco (non esaustivo) dei principali capoluoghi italiani, usato per
// proporre automaticamente la Provincia quando si scrive la Città. Resta sempre modificabile
// a mano: questo è solo un aiuto per velocizzare la compilazione, non un vincolo.
export const ITALIAN_CITY_TO_PROVINCE: Record<string, string> = {
  "roma": "RM", "milano": "MI", "napoli": "NA", "torino": "TO", "palermo": "PA",
  "genova": "GE", "bologna": "BO", "firenze": "FI", "bari": "BA", "catania": "CT",
  "venezia": "VE", "verona": "VR", "messina": "ME", "padova": "PD", "trieste": "TS",
  "taranto": "TA", "brescia": "BS", "prato": "PO", "reggio calabria": "RC",
  "modena": "MO", "reggio emilia": "RE", "perugia": "PG", "livorno": "LI",
  "ravenna": "RA", "cagliari": "CA", "foggia": "FG", "rimini": "RN", "salerno": "SA",
  "ferrara": "FE", "sassari": "SS", "latina": "LT", "giugliano in campania": "NA",
  "monza": "MB", "siracusa": "SR", "pescara": "PE", "bergamo": "BG", "forlì": "FC",
  "trento": "TN", "vicenza": "VI", "terni": "TR", "bolzano": "BZ", "novara": "NO",
  "piacenza": "PC", "ancona": "AN", "andria": "BT", "arezzo": "AR", "udine": "UD",
  "cesena": "FC", "lecce": "LE", "pesaro": "PU", "barletta": "BT", "alessandria": "AL",
  "la spezia": "SP", "pistoia": "PT", "pisa": "PI", "catanzaro": "CZ", "brindisi": "BR",
  "torre del greco": "NA", "como": "CO", "grosseto": "GR", "sesto san giovanni": "MI",
  "varese": "VA", "asti": "AT", "cinisello balsamo": "MI", "gela": "CL", "cremona": "CR",
  "lucca": "LU", "carpi": "MO", "quartu sant'elena": "CA", "treviso": "TV",
  "san severo": "FG", "massa": "MS", "viterbo": "VT", "vittoria": "RG", "imola": "BO",
  "aprilia": "LT", "cosenza": "CS", "trapani": "TP", "potenza": "PZ",
  "castellammare di stabia": "NA", "matera": "MT", "savona": "SV", "pavia": "PV",
  "guidonia montecelio": "RM", "afragola": "NA", "benevento": "BN", "l'aquila": "AQ",
  "vigevano": "PV", "ragusa": "RG", "carrara": "MS", "casoria": "NA", "pomezia": "RM",
  "crotone": "KR", "verbania": "VB", "siena": "SI", "chieti": "CH",
  "campobasso": "CB", "isernia": "IS", "aosta": "AO", "gorizia": "GO", "belluno": "BL",
  "rovigo": "RO", "biella": "BI", "vercelli": "VC", "cuneo": "CN", "sondrio": "SO",
  "lecco": "LC", "lodi": "LO", "mantova": "MN", "fermo": "FM", "macerata": "MC",
  "rieti": "RI", "frosinone": "FR", "avellino": "AV", "nuoro": "NU", "oristano": "OR",
  "enna": "EN", "agrigento": "AG", "caltanissetta": "CL",
  "vibo valentia": "VV", "reggio nell'emilia": "RE", "fano": "PU", "civitavecchia": "RM",
  "olbia": "SS", "sanremo": "IM", "imperia": "IM"
};

export function guessProvinceFromCity(city: string): string {
  if (!city) return "";
  const clean = city.trim().toLowerCase();
  return ITALIAN_CITY_TO_PROVINCE[clean] || "";
}
