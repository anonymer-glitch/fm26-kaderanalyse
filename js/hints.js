// Logik-Schicht: regelbasierte Entscheidungs-Hinweise. Jede Regel ist bewusst
// einfach und nachvollziehbar (keine Blackbox-Bewertung). Alle Schwellenwerte
// sind eine erste Einschätzung/Annahme - hier zentral anpassbar, bis es eine
// Einstellmöglichkeit in der Oberfläche gibt.
var HINT_THRESHOLDS = {
  contractWarningMonths: 12,
  // Starspieler/Schlüsselspieler/Stammspieler gelten als "wichtig für die Mannschaft".
  importantMaxRank: statusRank('Stammspieler'),
  sellAgeMin: 30,
  sellSalaryPercentile: 0.75,
  loanAgeMax: 21,
  // alles unterhalb "Stammspieler" gilt für den Verleih-Hinweis als "niedriger Einsatzstatus".
  loanMinRank: statusRank('Stammspieler') + 1,
  positionThinCount: 2
};

var SELL_LOW_STATUSES = ['Ergänzungsspieler', 'Nicht benötigt'];

function monthsBetween(from, to) {
  if (!from || !to) return null;
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function computeSalaryThreshold(players, percentile) {
  var salaries = players
    .map(function (p) { return p.salary; })
    .filter(function (s) { return s != null; })
    .sort(function (a, b) { return a - b; });
  if (salaries.length === 0) return null;
  var idx = Math.min(salaries.length - 1, Math.floor(salaries.length * percentile));
  return salaries[idx];
}

// Berechnet die Hinweise für jeden Spieler und hängt sie als p.hints (Array von
// Strings) direkt an die übergebenen Spieler-Objekte an. referenceDate kann null
// sein (z.B. wenn kein Spieldatum gesetzt ist) - dann bleibt der Vertrags-Hinweis aus.
function applyHints(players, referenceDate) {
  var salaryThreshold = computeSalaryThreshold(players, HINT_THRESHOLDS.sellSalaryPercentile);

  players.forEach(function (p) {
    var hints = [];

    if (referenceDate && p.contractEnd) {
      var months = monthsBetween(referenceDate, p.contractEnd);
      if (months != null && months <= HINT_THRESHOLDS.contractWarningMonths &&
          statusRank(p.statusActual) <= HINT_THRESHOLDS.importantMaxRank) {
        hints.push('Vertrag prüfen');
      }
    }

    if (p.age != null && p.age >= HINT_THRESHOLDS.sellAgeMin &&
        SELL_LOW_STATUSES.indexOf(p.statusActual) !== -1 &&
        salaryThreshold != null && p.salary != null && p.salary >= salaryThreshold) {
      hints.push('Verkaufskandidat');
    }

    if (p.age != null && p.age <= HINT_THRESHOLDS.loanAgeMax &&
        statusRank(p.statusActual) >= HINT_THRESHOLDS.loanMinRank) {
      hints.push('Verleihkandidat');
    }

    p.hints = hints;
  });
}

// Für jeden Positionscode: wie viele Spieler im Kader sind dort einsetzbar.
function computePositionGaps(players, positionSlots) {
  return positionSlots.map(function (slot) {
    var count = players.filter(function (p) {
      return p.positionSlots.indexOf(slot) !== -1;
    }).length;
    return { code: slot, count: count, thin: count < HINT_THRESHOLDS.positionThinCount };
  });
}
