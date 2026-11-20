import assert from "node:assert/strict";
import test from "node:test";
import { CONSTELLATION_FACTS, constellationFactForId } from "../src/campaign/constellation-facts.js";
import { CONTENT_CONSTELLATIONS } from "../src/campaign/content.js";
import { iauForConstellation } from "../src/ui/astronomical-catalogue.js";

const skySize = 88;

test("the facts cover the playable catalogue by stable ID and official IAU abbreviation", () => {
  const expected = new Map(CONTENT_CONSTELLATIONS.map((entry) => [entry.id, iauForConstellation(entry)]));
  assert.equal(expected.size, skySize);
  assert.equal(CONSTELLATION_FACTS.length, skySize);
  assert.equal(new Set(CONSTELLATION_FACTS.map(({ iau }) => iau)).size, skySize);

  for (const fact of CONSTELLATION_FACTS) {
    assert.equal(fact.iau, expected.get(fact.id), fact.id);
    assert.match(fact.iau, /^[A-Z][A-Za-z]{2}$/, fact.id);
    assert.equal(constellationFactForId(fact.id), fact);
    expected.delete(fact.id);
  }

  assert.equal(expected.size, 0);
  assert.equal(constellationFactForId("UMa"), null);
  assert.equal(constellationFactForId("Grande Ourse"), null);
});

test("all facts have distinct, short editorial content and documentary references", () => {
  for (const field of ["name", "nameOrigin", "funFact"]) {
    assert.equal(new Set(CONSTELLATION_FACTS.map((fact) => fact[field])).size, skySize, field);
  }

  for (const fact of CONSTELLATION_FACTS) {
    for (const field of ["name", "nameOrigin", "funFact"]) {
      assert.equal(typeof fact[field], "string", fact.id + " " + field);
      assert.ok(fact[field].trim().length > 0 && fact[field].length <= 240, fact.id + " " + field);
    }
    assert.ok(fact.sources.length >= 2, fact.id);
    assert.equal(new Set(fact.sources).size, fact.sources.length, fact.id);
    assert.ok(fact.sources.every((source) => new URL(source).protocol === "https:"), fact.id);
    assert.ok(Object.isFrozen(fact) && Object.isFrozen(fact.sources), fact.id);
    assert.ok(!Object.keys(fact).some((key) => /distance|starcount|numberofstars/i.test(key)), fact.id);
    for (const field of ["nameOrigin", "funFact"]) {
      assert.doesNotMatch(fact[field], /\d+\s+(?:étoiles?|années-lumière)/u, fact.id);
    }
  }
});

test("ranking uses unrounded Levin areas with Serpens counted as one constellation", () => {
  const ranked = [...CONSTELLATION_FACTS].sort((left, right) => left.areaRank - right.areaRank);
  assert.deepEqual(ranked.map(({ areaRank }) => areaRank), Array.from({ length: skySize }, (_, index) => index + 1));
  for (const [index, entry] of ranked.entries()) {
    assert.ok(Number.isInteger(entry.areaSqDeg) && entry.areaSqDeg > 0, entry.id);
    if (index > 0) assert.ok(entry.areaSqDeg <= ranked[index - 1].areaSqDeg, entry.id);
  }

  const checkpoints = [
    [1, 1303, "Hya"], [3, 1280, "UMa"], [23, 637, "Ser"],
    [72, 179, "Dor"], [73, 179, "CrB"], [78, 132, "Tri"],
    [79, 132, "Cha"], [88, 68, "Cru"],
  ];
  for (const [rank, surface, iau] of checkpoints) {
    assert.equal(ranked[rank - 1].iau, iau);
    assert.equal(ranked[rank - 1].areaSqDeg, surface);
  }
});
