// Logik-Schicht: "Leistung je Position" - im Unterschied zu Qualität je Position
// (Attribute/Potenzial) geht es hier um echte Saison-Leistungsdaten. Nutzt
// dieselbe Berechnung wie computePositionQuality (quality.js), nur mit einer
// global gültigen statt einer je-Position gewählten Attributliste, da eine
// Bewertungsnote positionsübergreifend vergleichbar ist (anders als z.B. Tore).
var PERFORMANCE_ATTRIBUTE_DEFAULTS = ['Durchschnittsnote – Verein'];

// Durchschnittsnote ist eine Dezimalzahl und taucht deshalb nicht in den generisch
// erkannten Ganzzahl-Spalten (numericColumns) auf - wird hier explizit ergänzt,
// falls im Export vorhanden.
function performanceAttributeOptions(headers, numericColumns) {
  var options = numericColumns.slice();
  if (headers.indexOf('Durchschnittsnote – Verein') !== -1 && options.indexOf('Durchschnittsnote – Verein') === -1) {
    options.push('Durchschnittsnote – Verein');
  }
  return options;
}

function defaultPerformanceAttributes(availableColumns) {
  return PERFORMANCE_ATTRIBUTE_DEFAULTS.filter(function (a) { return availableColumns.indexOf(a) !== -1; });
}

// computePositionQuality erwartet eine Attributliste je Wurzel-Position - hier
// bekommt jede Position dieselbe (globale) Liste.
function buildUniformAttributeMap(attrs) {
  var map = {};
  POSITION_ORDER.forEach(function (code) {
    map[code] = attrs;
  });
  return map;
}
