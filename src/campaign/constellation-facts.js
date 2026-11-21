import frenchFacts from '../ui/locales/fr/constellations.js';

// Propositions éditoriales pour #853 et #855, associées par ID de catalogue et code IAU.
// Les surfaces proviennent des calculs de A. E. Levin sur les limites de Delporte.
// Cette source commune est consultable sans réseau. Les références servent à la relecture.
const areaSource = "https://webspace.science.uu.nl/~gent0113/downloads/wgsn/levin_1934.pdf";

// Stable ID, IAU code, exact area in square degrees, sources. Text lives in the locale catalogues.
const entries = [
  ["real-01", "UMa", 1279.66, ["https://ase.exopla.net/index.php/Ursa_Major","https://science.nasa.gov/solar-system/what-is-the-north-star-and-how-do-you-find-it/"]],
  ["real-02", "Cas", 598.407, ["https://ase.exopla.net/index.php/Cassiopeia"]],
  ["real-03", "Cru", 68.447, ["https://ase.exopla.net/index.php/Crux","https://www.spacecentre.nz/resources/your-night-sky/2018/YourNightSky_2018-03-06_FindingSouth.html"]],
  ["real-04", "Lyr", 286.476, ["https://ase.exopla.net/index.php/Lyra"]],
  ["real-05", "Cyg", 803.983, ["https://ase.exopla.net/index.php/Cygnus"]],
  ["real-06", "Leo", 946.964, ["https://ase.exopla.net/index.php/Leo","https://science.nasa.gov/resource/whats-up-april-2021-video/"]],
  ["real-07", "Sco", 496.783, ["https://ase.exopla.net/index.php/Scorpius"]],
  ["real-08", "Gem", 513.761, ["https://ase.exopla.net/index.php/Gemini"]],
  ["real-09", "Tau", 797.249, ["https://ase.exopla.net/index.php/Taurus","https://science.nasa.gov/solar-system/skywatching/night-sky-network/spot-the-young-stars-of-the-hyades-and-pleiades/"]],
  ["real-10", "Aql", 652.473, ["https://ase.exopla.net/index.php/Aquila"]],
  ["real-11", "And", 722.278, ["https://ase.exopla.net/index.php/Andromeda","https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/"]],
  ["real-12", "Ori", 594.12, ["https://ase.exopla.net/index.php/Orion","https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-42/"]],
  ["real-13", "Peg", 1120.794, ["https://ase.exopla.net/index.php/Pegasus"]],
  ["real-14", "Per", 614.997, ["https://ase.exopla.net/index.php/Perseus"]],
  ["real-15", "Dra", 1082.952, ["https://ase.exopla.net/index.php/Draco","https://science.nasa.gov/resource/whats-up-april-2019-skywatching-from-nasa/"]],
  ["real-16", "Cep", 587.787, ["https://ase.exopla.net/index.php/Cepheus"]],
  ["real-17", "Boo", 906.831, ["https://ase.exopla.net/index.php/Bootes"]],
  ["real-18", "CrB", 178.71, ["https://ase.exopla.net/index.php/Corona_Borealis","https://mintaka.aavso.org/vsots_rcrb"]],
  ["real-19", "Sgr", 867.432, ["https://ase.exopla.net/index.php/Sagittarius"]],
  ["real-20", "Cap", 413.947, ["https://ase.exopla.net/index.php/Capricornus","https://ase.exopla.net/index.php/SU%E1%B8%AAUR.MA%C5%A02"]],
  ["real-21", "Aqr", 979.854, ["https://ase.exopla.net/index.php/Aquarius","https://science.nasa.gov/solar-system/meteors-meteorites/eta-aquarids/"]],
  ["real-22", "Psc", 889.417, ["https://ase.exopla.net/index.php/Pisces","https://ase.exopla.net/index.php/Alrescha"]],
  ["real-23", "Vir", 1294.428, ["https://ase.exopla.net/index.php/Virgo"]],
  ["real-24", "CMa", 380.118, ["https://ase.exopla.net/index.php/Canis_Major"]],
  ["iau-ant", "Ant", 238.901, ["https://ase.exopla.net/index.php/Antlia"]],
  ["iau-aps", "Aps", 206.327, ["https://ase.exopla.net/index.php/Apus"]],
  ["iau-ara", "Ara", 237.057, ["https://ase.exopla.net/index.php/Ara"]],
  ["iau-ari", "Ari", 441.395, ["https://ase.exopla.net/index.php/Aries"]],
  ["iau-aur", "Aur", 657.438, ["https://ase.exopla.net/index.php/Auriga"]],
  ["iau-cae", "Cae", 124.865, ["https://ase.exopla.net/index.php/Caelum"]],
  ["iau-cam", "Cam", 756.828, ["https://ase.exopla.net/index.php/Camelopardalis"]],
  ["iau-cnc", "Cnc", 505.872, ["https://ase.exopla.net/index.php/Cancer","https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-44/"]],
  ["iau-cvn", "CVn", 465.194, ["https://ase.exopla.net/index.php/Canes_Venatici","https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-51/"]],
  ["iau-cmi", "CMi", 183.367, ["https://ase.exopla.net/index.php/Canis_Minor","https://ase.exopla.net/index.php/Procyon"]],
  ["real-adventure-03-new-01", "Del", 188.549, ["https://ase.exopla.net/index.php/Delphinus"]],
  ["real-adventure-03-new-02", "Equ", 71.641, ["https://ase.exopla.net/index.php/Equuleus"]],
  ["real-adventure-03-new-03", "Her", 1225.148, ["https://ase.exopla.net/index.php/Hercules","https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-13/"]],
  ["real-adventure-03-new-04", "Lep", 290.291, ["https://ase.exopla.net/index.php/Lepus"]],
  ["real-adventure-03-new-05", "Mon", 481.569, ["https://ase.exopla.net/index.php/Monoceros","https://www.eso.org/public/unitedkingdom/images/b12/"]],
  ["real-adventure-03-new-06", "Oph", 948.34, ["https://ase.exopla.net/index.php/Ophiuchus"]],
  ["iau-cet", "Cet", 1231.411, ["https://ase.exopla.net/index.php/Cetus"]],
  ["iau-col", "Col", 270.184, ["https://ase.exopla.net/index.php/Columba"]],
  ["iau-crv", "Crv", 183.801, ["https://ase.exopla.net/index.php/Corvus"]],
  ["iau-crt", "Crt", 282.398, ["https://ase.exopla.net/index.php/Crater"]],
  ["iau-dor", "Dor", 179.173, ["https://ase.exopla.net/index.php/Dorado","https://www.eso.org/public/images/eso1816d/"]],
  ["iau-eri", "Eri", 1137.919, ["https://ase.exopla.net/index.php/Eridanus","https://ase.exopla.net/index.php/Achernar"]],
  ["iau-gru", "Gru", 365.513, ["https://ase.exopla.net/index.php/Grus"]],
  ["iau-hyi", "Hyi", 243.035, ["https://ase.exopla.net/index.php/Hydrus"]],
  ["iau-lac", "Lac", 200.688, ["https://ase.exopla.net/index.php/Lacerta"]],
  ["iau-lup", "Lup", 333.683, ["https://ase.exopla.net/index.php/Lupus"]],
  ["iau-for", "For", 397.502, ["https://ase.exopla.net/index.php/Fornax","https://www.eso.org/public/images/eso1612c/"]],
  ["iau-hor", "Hor", 248.885, ["https://ase.exopla.net/index.php/Horologium"]],
  ["iau-ret", "Ret", 113.936, ["https://ase.exopla.net/index.php/Reticulum"]],
  ["iau-pic", "Pic", 246.739, ["https://ase.exopla.net/index.php/Pictor"]],
  ["iau-scl", "Scl", 474.764, ["https://ase.exopla.net/index.php/Sculptor"]],
  ["iau-mic", "Mic", 209.513, ["https://ase.exopla.net/index.php/Microscopium"]],
  ["iau-tel", "Tel", 251.512, ["https://ase.exopla.net/index.php/Telescopium"]],
  ["iau-cir", "Cir", 93.353, ["https://ase.exopla.net/index.php/Circinus"]],
  ["iau-nor", "Nor", 165.29, ["https://ase.exopla.net/index.php/Norma"]],
  ["iau-sex", "Sex", 313.515, ["https://ase.exopla.net/index.php/Sextans"]],
  ["iau-pyx", "Pyx", 220.833, ["https://ase.exopla.net/index.php/Pyxis"]],
  ["iau-vol", "Vol", 141.354, ["https://ase.exopla.net/index.php/Volans"]],
  ["iau-mus", "Mus", 138.355, ["https://ase.exopla.net/index.php/Musca"]],
  ["iau-ind", "Ind", 294.006, ["https://ase.exopla.net/index.php/Indus"]],
  ["iau-tuc", "Tuc", 294.557, ["https://ase.exopla.net/index.php/Tucana","https://www.esa.int/Science_Exploration/Space_Science/Star-forming_region_in_nebula_NGC_346"]],
  ["iau-pav", "Pav", 377.666, ["https://ase.exopla.net/index.php/Pavo"]],
  ["iau-phe", "Phe", 469.319, ["https://ase.exopla.net/index.php/Phoenix"]],
  ["iau-car", "Car", 494.184, ["https://ase.exopla.net/index.php/Carina","https://science.nasa.gov/missions/hubble/hubbles-sparkling-new-view-of-the-carina-nebula/"]],
  ["iau-pup", "Pup", 673.434, ["https://ase.exopla.net/index.php/Puppis","https://ase.exopla.net/index.php/Argo"]],
  ["iau-vel", "Vel", 499.649, ["https://ase.exopla.net/index.php/Vela","https://science.nasa.gov/universe/stars/types/"]],
  ["iau-lmi", "LMi", 231.956, ["https://ase.exopla.net/index.php/Leo_Minor"]],
  ["iau-lyn", "Lyn", 545.386, ["https://ase.exopla.net/index.php/Lynx"]],
  ["iau-vul", "Vul", 268.165, ["https://ase.exopla.net/index.php/Vulpecula"]],
  ["iau-com", "Com", 386.475, ["https://ase.exopla.net/index.php/Coma_Berenices"]],
  ["iau-lib", "Lib", 538.052, ["https://ase.exopla.net/index.php/Libra"]],
  ["iau-cra", "CrA", 127.696, ["https://ase.exopla.net/index.php/Corona_Australis"]],
  ["iau-sct", "Sct", 109.114, ["https://ase.exopla.net/index.php/Scutum"]],
  ["iau-ser", "Ser", 636.928, ["https://ase.exopla.net/index.php/Serpens"]],
  ["iau-hya", "Hya", 1302.844, ["https://ase.exopla.net/index.php/Hydra"]],
  ["iau-cen", "Cen", 1060.422, ["https://ase.exopla.net/index.php/Centaurus","https://science.nasa.gov/asset/hubble/proxima-centauri/"]],
  ["iau-sge", "Sge", 79.932, ["https://ase.exopla.net/index.php/Sagitta"]],
  ["iau-tri", "Tri", 131.847, ["https://ase.exopla.net/index.php/Triangulum","https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/"]],
  ["iau-tra", "TrA", 109.978, ["https://ase.exopla.net/index.php/Triangulum_Australe"]],
  ["iau-psa", "PsA", 245.375, ["https://ase.exopla.net/index.php/Piscis_Austrinus"]],
  ["iau-cha", "Cha", 131.592, ["https://ase.exopla.net/index.php/Chamaeleon"]],
  ["iau-men", "Men", 153.484, ["https://ase.exopla.net/index.php/Mensa","https://ase.exopla.net/index.php/Hoerikwaggo"]],
  ["iau-oct", "Oct", 291.045, ["https://ase.exopla.net/index.php/Octans"]],
  ["iau-umi", "UMi", 255.864, ["https://ase.exopla.net/index.php/Ursa_Minor","https://science.nasa.gov/resource/whats-up-april-2019-skywatching-from-nasa/"]],
];

const areaRanks = new Map(
  entries.slice().sort((left, right) => right[2] - left[2]).map((entry, index) => [entry[1], index + 1]),
);

export const CONSTELLATION_FACTS = Object.freeze(
  entries.map(([id, iau, exactAreaSqDeg, sources]) => Object.freeze({
    id,
    iau,
    name: frenchFacts['constellation.'+iau+'.name'],
    nameOrigin: frenchFacts['constellation.'+iau+'.nameOrigin'],
    funFact: frenchFacts['constellation.'+iau+'.funFact'],
    areaSqDeg: Math.round(exactAreaSqDeg),
    areaRank: areaRanks.get(iau),
    sources: Object.freeze([...sources, areaSource]),
  })),
);

const byId = new Map(CONSTELLATION_FACTS.map((fact) => [fact.id, fact]));

export function constellationFactForId(id) {
  return byId.get(id) ?? null;
}

export function localizedConstellationFact(fact,t){
  const field=key=>t('constellation.'+fact.iau+'.'+key);
  return {...fact,name:field('name'),nameOrigin:field('nameOrigin'),funFact:field('funFact')};
}

export function constellationDisplayName(id,t,fallback){
  const fact=constellationFactForId(id);
  return fact?t('constellation.'+fact.iau+'.name'):fallback;
}
