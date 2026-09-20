// Logik-Schicht: regelbasierte Entscheidungs-Hinweise. Jede Regel ist bewusst
// einfach und nachvollziehbar (keine Blackbox-Bewertung). Alle Schwellenwerte
// sind eine erste Einschätzung/Annahme - hier zentral anpassbar, bis es eine
// Einstellmöglichkeit in der Oberfläche gibt.
var HINT_THRESHOLDS = {
  contractWarningMonths: 12,
  sellAgeMin: 30,
  sellSalaryPercentile: 0.75,
  loanAgeMax: 21,
  // alles unterhalb "Stammspieler" gilt für den Verleih-Hinweis als "niedriger Einsatzstatus".
  loanMinRank: statusRank('Stammspieler') + 1,
  positionThinCount: 2,
  // Eine Position gilt als "schwache Qualität", wenn ihr Ø-Wert um mindestens
  // diesen Abstand unter dem Ø aller Positionen dieses Kaders liegt (relativ
  // zum eigenen Kader, nicht zu einer absoluten Liga-Norm).
  qualityWeakMargin: 1.5,
  // Für den Leistungs-Pfad beim Verkaufskandidat: Notenpunkte unter dem
  // Kader-Ø der Durchschnittsnote, ab denen ein Spieler als "leistet aktuell
  // wenig" gilt (Notenskala ist deutlich enger als die 1-20-Attributskala).
  ratingWeakMargin: 0.3
};

var SELL_LOW_STATUSES = ['Ergänzungsspieler', 'Nicht benötigt'];

// "Vertrag prüfen" gilt für alle Status außer "Nicht benötigt" - die können ohnehin
// gehen, der Rest soll (erstmal) gehalten werden.
var CONTRACT_WARNING_EXCLUDED_STATUSES = ['Nicht benötigt'];

function monthsBetween(from, to) {
  if (!from || !to) return null;
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

// FM-Verträge enden in diesen Daten immer am 30.6. - die "Saison" eines Datums
// ist deshalb das Kalenderjahr des kommenden 30.6. (Juli-Dezember -> nächstes Jahr).
function seasonEndYear(date) {
  return date.getMonth() <= 5 ? date.getFullYear() : date.getFullYear() + 1;
}

// Alle Spieler, deren Vertrag in derselben Saison wie referenceDate endet.
// Gibt null zurück, wenn kein Spieldatum gesetzt ist.
function computeContractCluster(players, referenceDate) {
  if (!referenceDate) return null;
  var year = seasonEndYear(referenceDate);
  var matches = players.filter(function (p) {
    return p.contractEnd && p.contractEnd.getFullYear() === year;
  });
  return { seasonEndYear: year, players: matches };
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

  var ratings = players.map(function (p) { return p.rating; }).filter(function (r) { return r != null; });
  var ratingMean = ratings.length > 0
    ? ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length
    : null;

  players.forEach(function (p) {
    var hints = [];
    var hintReasons = {};

    if (referenceDate && p.contractEnd) {
      var months = monthsBetween(referenceDate, p.contractEnd);
      if (months != null && months <= HINT_THRESHOLDS.contractWarningMonths &&
          CONTRACT_WARNING_EXCLUDED_STATUSES.indexOf(p.statusActual) === -1) {
        hints.push('Vertrag prüfen');
        hintReasons['Vertrag prüfen'] = 'Vertrag endet ' + p.contractEndRaw + ' (' + months + ' Mon.), Status ' + p.statusActual;
      }
    }

    var highSalary = salaryThreshold != null && p.salary != null && p.salary >= salaryThreshold;
    var oldAndSidelined = p.age != null && p.age >= HINT_THRESHOLDS.sellAgeMin &&
        SELL_LOW_STATUSES.indexOf(p.statusActual) !== -1;
    var underperforming = p.rating != null && ratingMean != null &&
        p.rating <= ratingMean - HINT_THRESHOLDS.ratingWeakMargin;

    if (highSalary && (oldAndSidelined || underperforming)) {
      hints.push('Verkaufskandidat');
      var sellReasons = ['Gehalt ' + p.salaryRaw + ' (oberstes Viertel im Kader)'];
      if (oldAndSidelined) sellReasons.push('Alter ' + p.age + ' + Status ' + p.statusActual);
      if (underperforming) sellReasons.push('Note ' + p.rating.toFixed(2) + ' unter Kader-Ø ' + ratingMean.toFixed(2));
      hintReasons['Verkaufskandidat'] = sellReasons.join(' + ');
    }

    if (p.age != null && p.age <= HINT_THRESHOLDS.loanAgeMax &&
        statusRank(p.statusActual) >= HINT_THRESHOLDS.loanMinRank) {
      hints.push('Verleihkandidat');
      hintReasons['Verleihkandidat'] = 'Alter ' + p.age + ' + Status ' + p.statusActual;
    }

    p.hints = hints;
    p.hintReasons = hintReasons;
  });
}

// Für jeden Positionscode: wie viele Spieler im Kader sind dort einsetzbar.
// severity: 'missing' (0 Spieler), 'thin' (weniger als positionThinCount), 'ok'.
function computePositionGaps(players, positionSlots) {
  return positionSlots.map(function (slot) {
    var count = players.filter(function (p) {
      return p.positionSlots.indexOf(slot) !== -1;
    }).length;
    var severity = count === 0 ? 'missing' : (count < HINT_THRESHOLDS.positionThinCount ? 'thin' : 'ok');
    return { code: slot, count: count, severity: severity };
  });
}

// Berechnet für jeden Positions-Slot den Ø der Durchschnittsnote (dieselbe
// Kennzahl, die "Leistung je Position" standardmäßig nutzt) - unabhängig davon,
// welche zusätzlichen Kennzahlen der Nutzer sich dort noch dazu ausgewählt hat,
// da sich die nicht sinnvoll zu einem Wert mischen lassen (siehe performance.js).
function computePositionRatings(players) {
  return sortBySlotOrder(collectPositionSlots(players)).map(function (slot) {
    var relevantPlayers = players.filter(function (p) {
      return p.positionSlots.indexOf(slot) !== -1;
    });
    var ratings = relevantPlayers.map(function (p) { return p.rating; }).filter(function (r) { return r != null; });
    var average = ratings.length > 0
      ? ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length
      : null;
    return { code: slot, playerCount: relevantPlayers.length, average: average };
  });
}

// Fasst Positionslücken, Qualität je Position und Durchschnittsnote je Position
// zu einer Liste "Handlungsbedarf" zusammen: jeder Slot mit zu wenig Spielern
// und/oder auffällig schwacher Qualität/Leistung (jeweils relativ zum Ø aller
// Positionen dieses Kaders), sortiert nach Position auf dem Feld.
function computePositionActionItems(gapResults, qualityResults, ratingResults) {
  function byCode(results) {
    var map = {};
    results.forEach(function (r) { map[r.code] = r; });
    return map;
  }
  function meanOfAverages(results) {
    var values = results.map(function (r) { return r.average; }).filter(function (v) { return v != null; });
    return values.length > 0 ? values.reduce(function (a, b) { return a + b; }, 0) / values.length : null;
  }

  var qualityByCode = byCode(qualityResults);
  var qualityMean = meanOfAverages(qualityResults);
  var ratingByCode = byCode(ratingResults);
  var ratingMean = meanOfAverages(ratingResults);

  var slots = {};
  gapResults.forEach(function (g) { slots[g.code] = true; });
  qualityResults.forEach(function (r) { slots[r.code] = true; });
  ratingResults.forEach(function (r) { slots[r.code] = true; });

  var items = [];
  Object.keys(slots).forEach(function (slot) {
    var reasons = [];

    var gap = gapResults.filter(function (g) { return g.code === slot; })[0];
    if (gap && gap.severity !== 'ok') {
      reasons.push(gap.severity === 'missing' ? 'keine Spieler' : 'nur ' + gap.count + ' Spieler');
    }

    var quality = qualityByCode[slot];
    if (quality && quality.average != null && qualityMean != null &&
        quality.average <= qualityMean - HINT_THRESHOLDS.qualityWeakMargin) {
      reasons.push('schwache Qualität (Ø ' + quality.average.toFixed(1) + ')');
    }

    var rating = ratingByCode[slot];
    if (rating && rating.average != null && ratingMean != null &&
        rating.average <= ratingMean - HINT_THRESHOLDS.ratingWeakMargin) {
      reasons.push('schwache Leistung (Ø Note ' + rating.average.toFixed(2) + ')');
    }

    if (reasons.length > 0) {
      var playerCount = quality ? quality.playerCount : (rating ? rating.playerCount : (gap ? gap.count : 0));
      items.push({ slot: slot, playerCount: playerCount, reasons: reasons });
    }
  });

  var order = sortBySlotOrder(items.map(function (i) { return i.slot; }));
  return order.map(function (slot) {
    return items.filter(function (i) { return i.slot === slot; })[0];
  });
}
