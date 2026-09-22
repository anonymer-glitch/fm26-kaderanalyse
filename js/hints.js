// Logik-Schicht: regelbasierter Handlungsbedarf. Jede Regel ist bewusst
// einfach und nachvollziehbar (keine Blackbox-Bewertung). Alle Schwellenwerte
// sind Startwerte, über die Oberfläche im Handlungsbedarf-Reiter einstellbar
// (siehe HINT_THRESHOLD_SETTINGS unten + mergeHintThresholds).
var DEFAULT_HINT_THRESHOLDS = {
  contractWarningMonths: 12,
  // Gilt für Gehalt und Marktwert gleichermaßen (oberstes Viertel im Kader).
  sellValuePercentile: 0.75,
  loanAgeMax: 21,
  // Alles unterhalb "Rotationsspieler" gilt für den Verleih-Hinweis als "niedriger
  // Einsatzstatus" - Rotationsspieler selbst soll im Kader bleiben (bekommt schon
  // regelmäßig Einsätze), "Nicht benötigt" wird separat immer zum Verkaufskandidat.
  // Bewusst nicht über die Oberfläche einstellbar (kein einfacher Zahlenwert,
  // sondern an einen konkreten Status-Namen gebunden).
  loanMinRank: statusRank('Rotationsspieler') + 1,
  // Ziel-Kadertiefe je Positions-Slot = benötigte Starter (aus dem Taktik-Board,
  // z.B. 2 Marker auf "V (Z)" = 2 Starter) mal diesem Faktor - z.B. 2 Starter auf
  // Innenverteidiger -> Zieltiefe 4 im Kader für Rotation/Ausfallsicherheit.
  positionDepthMultiplier: 2,
  // Eine Position gilt als "schwache Qualität", wenn ihr Ø-Wert um mindestens
  // diesen Abstand unter dem Ø aller Positionen dieses Kaders liegt (relativ
  // zum eigenen Kader, nicht zu einer absoluten Liga-Norm).
  qualityWeakMargin: 1.5,
  // Für den Leistungs-Pfad beim Verkaufskandidat: Notenpunkte unter dem
  // Kader-Ø der Durchschnittsnote, ab denen ein Spieler als "leistet aktuell
  // wenig" gilt (Notenskala ist deutlich enger als die 1-20-Attributskala).
  ratingWeakMargin: 0.3,
  // Mindestabstand (in Stufen von PLAYING_TIME_ORDER, insgesamt 9 Stufen)
  // zwischen "Tatsächliche Einsatzzeiten" und "Einsatzzeiten", ab dem die
  // Diskrepanz als auffällig gilt.
  statusGapMinDiff: 3
};

// Editierbare Schwellenwerte für die Einstell-Oberfläche im Handlungsbedarf-
// Reiter. "scale" rechnet zwischen internem Wert (z.B. 0.75) und Anzeigewert
// (z.B. 75 %) um - reine Darstellungssache, gespeichert/gerechnet wird immer
// mit dem internen Wert. loanMinRank taucht hier bewusst nicht auf (s.o.).
var HINT_THRESHOLD_SETTINGS = [
  { key: 'contractWarningMonths', label: 'Vertrag prüfen: Restlaufzeit in Monaten', step: 1, min: 0, scale: 1, suffix: 'Monate' },
  { key: 'sellValuePercentile', label: 'Verkaufskandidat: Gehalt/Marktwert-Schwelle (oberste X % im Kader)', step: 1, min: 1, max: 100, scale: 100, suffix: '%' },
  { key: 'loanAgeMax', label: 'Verleihkandidat: Alter bis', step: 1, min: 0, scale: 1, suffix: 'Jahre' },
  { key: 'positionDepthMultiplier', label: 'Ziel-Kadertiefe je Position: Starter ×', step: 0.5, min: 1, scale: 1, suffix: '' },
  { key: 'qualityWeakMargin', label: 'Position: Handlungsbedarf – schwache Qualität ab Abstand zum Kader-Ø', step: 0.1, min: 0, scale: 1, suffix: 'Attribut-Punkte' },
  { key: 'ratingWeakMargin', label: 'Position/Verkaufskandidat: schwache Leistung ab Abstand zur Kader-Ø-Note', step: 0.05, min: 0, scale: 1, suffix: 'Notenpunkte' },
  { key: 'statusGapMinDiff', label: 'Status-Diskrepanz ab wie vielen Stufen Unterschied', step: 1, min: 1, scale: 1, suffix: 'Stufen' }
];

// Baut die tatsächlich verwendeten Schwellenwerte aus den Standardwerten plus
// optionalen Overrides (z.B. aus localStorage) - fehlende/ungültige Werte
// fallen automatisch auf den Standard zurück, damit ein kaputter/alter
// gespeicherter Stand die App nie zum Absturz bringt.
function mergeHintThresholds(overrides) {
  var merged = {};
  Object.keys(DEFAULT_HINT_THRESHOLDS).forEach(function (key) { merged[key] = DEFAULT_HINT_THRESHOLDS[key]; });
  if (overrides) {
    HINT_THRESHOLD_SETTINGS.forEach(function (field) {
      var val = overrides[field.key];
      if (typeof val === 'number' && isFinite(val)) merged[field.key] = val;
    });
  }
  return merged;
}

// "Nicht benötigt" ist ein eigener, immer greifender Auslöser (siehe applyHints) -
// hier nur noch für den gehaltsabhängigen "kleine Rolle"-Pfad.
var SELL_LOW_STATUSES = ['Ergänzungsspieler'];

// Status, die immer (unabhängig von Gehalt/Marktwert/Note) Verkaufskandidat auslösen.
var ALWAYS_SELL_STATUSES = ['Nicht benötigt'];

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

// Perzentil-Schwelle (z.B. "oberstes Viertel") über einen beliebigen Zahlenwert
// der Spieler - wiederverwendet für Gehalt und Marktwert.
function computeValueThreshold(players, selector, percentile) {
  var values = players
    .map(selector)
    .filter(function (v) { return v != null; })
    .sort(function (a, b) { return a - b; });
  if (values.length === 0) return null;
  var idx = Math.min(values.length - 1, Math.floor(values.length * percentile));
  return values[idx];
}

// Berechnet die Hinweise für jeden Spieler und hängt sie als p.hints (Array von
// Strings) direkt an die übergebenen Spieler-Objekte an. referenceDate kann null
// sein (z.B. wenn kein Spieldatum gesetzt ist) - dann bleibt der Vertrags-Hinweis aus.
// thresholds kommt aus mergeHintThresholds (state.hintThresholds in app.js).
function applyHints(players, referenceDate, thresholds) {
  var salaryThreshold = computeValueThreshold(players, function (p) { return p.salary; }, thresholds.sellValuePercentile);
  var marketValueThreshold = computeValueThreshold(players, function (p) { return p.marketValue; }, thresholds.sellValuePercentile);

  var ratings = players.map(function (p) { return p.rating; }).filter(function (r) { return r != null; });
  var ratingMean = ratings.length > 0
    ? ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length
    : null;

  players.forEach(function (p) {
    var hints = [];
    var hintReasons = {};

    if (referenceDate && p.contractEnd) {
      var months = monthsBetween(referenceDate, p.contractEnd);
      if (months != null && months <= thresholds.contractWarningMonths &&
          CONTRACT_WARNING_EXCLUDED_STATUSES.indexOf(p.statusActual) === -1) {
        hints.push('Vertrag prüfen');
        hintReasons['Vertrag prüfen'] = 'Vertrag endet ' + p.contractEndRaw + ' (' + months + ' Mon.), Status ' + p.statusActual;
      }
    }

    var highSalary = salaryThreshold != null && p.salary != null && p.salary >= salaryThreshold;
    var highMarketValue = marketValueThreshold != null && p.marketValue != null && p.marketValue >= marketValueThreshold;
    var lowRoleStatus = SELL_LOW_STATUSES.indexOf(p.statusActual) !== -1;
    var underperforming = p.rating != null && ratingMean != null &&
        p.rating <= ratingMean - thresholds.ratingWeakMargin;

    // Zwei unabhängige Auslöser: (1) hohes Gehalt für eine kleine Rolle, egal
    // welches Alter - kostet unnötig viel für wenig Einsatz. (2) hohes Gehalt
    // ODER hoher Marktwert bei gleichzeitig schwacher Note - Wert/Gehalt nutzen,
    // solange er da ist, statt weiter auf eine Erholung zu warten.
    var expensiveForRole = highSalary && lowRoleStatus;
    var valueVsPerformance = (highSalary || highMarketValue) && underperforming;
    var notNeeded = ALWAYS_SELL_STATUSES.indexOf(p.statusActual) !== -1;

    if (notNeeded || expensiveForRole || valueVsPerformance) {
      hints.push('Verkaufskandidat');
      var sellReasons = [];
      if (notNeeded) {
        sellReasons.push('Status "' + p.statusActual + '" - kein Teil der Kaderplanung');
      }
      if (expensiveForRole) {
        sellReasons.push('Gehalt ' + p.salaryRaw + ' (oberstes Viertel) für kleine Rolle (' + p.statusActual + ')');
      }
      if (valueVsPerformance) {
        var valueBits = [];
        if (highSalary) valueBits.push('Gehalt ' + p.salaryRaw);
        if (highMarketValue) valueBits.push('Marktwert ' + p.marketValueRaw);
        sellReasons.push(valueBits.join(' + ') + ' (oberstes Viertel) + Note ' + p.rating.toFixed(2) + ' unter Kader-Ø ' + ratingMean.toFixed(2));
      }
      hintReasons['Verkaufskandidat'] = sellReasons.join(' + ');
    }

    // "Nicht benötigt" ist oben schon immer Verkaufskandidat - hier bewusst
    // ausgeschlossen, damit ein Spieler nicht gleichzeitig als Verleih- UND
    // Verkaufskandidat auftaucht.
    if (p.age != null && p.age <= thresholds.loanAgeMax &&
        statusRank(p.statusActual) >= thresholds.loanMinRank &&
        ALWAYS_SELL_STATUSES.indexOf(p.statusActual) === -1) {
      hints.push('Verleihkandidat');
      hintReasons['Verleihkandidat'] = 'Alter ' + p.age + ' + Status ' + p.statusActual;
    }

    if (p.statusActual && p.statusExpected) {
      var statusGap = statusRank(p.statusActual) - statusRank(p.statusExpected);
      if (Math.abs(statusGap) >= thresholds.statusGapMinDiff) {
        hints.push('Status-Diskrepanz');
        var direction = statusGap > 0 ? 'spielt weniger als vereinbart' : 'spielt mehr als vereinbart';
        hintReasons['Status-Diskrepanz'] = 'Tatsächlich: ' + p.statusActual + ', Vereinbart: ' + p.statusExpected + ' (' + direction + ')';
      }
    }

    p.hints = hints;
    p.hintReasons = hintReasons;
  });
}

// Für jeden Positions-Slot (mit Starter-Anzahl aus dem Taktik-Board, siehe
// neededPositionCountsFromMarkers): wie viele Spieler im Kader sind dort
// einsetzbar, gemessen an der Kadertiefe, die die aktuelle Taktik braucht.
// Ziel-Kadertiefe = Starter-Anzahl * positionDepthMultiplier. Ampel:
// 'missing' (0 Spieler) -> 'thin' (weniger als die Starter selbst, Taktik nicht
// bespielbar) -> 'tight' (Starter gedeckt, aber keine Rotation) -> 'ok' (Ziel
// erreicht).
// Slots ohne Seitenangabe (z.B. "TW", "DM", "ST") zählen jeden Spieler mit
// passendem Wurzel-Code, unabhängig von dessen eigener Seite - manche FM-
// Exports geben z.B. vielseitigen Stürmern trotzdem eine Seite ("ST (RL)").
// Slots MIT Seite (z.B. "V (L)") bleiben exakt, da die Seite hier zählt.
// Wiederverwendet von computePositionGaps (Zählung) und der Kadertiefe-
// Detailtabelle in app.js (welche Spieler genau zählen).
function playersMatchingSlot(players, slot) {
  var parsed = parsePositionSlot(slot);
  return players.filter(function (p) {
    return p.positionSlots.some(function (s) {
      if (parsed.side) return s === slot;
      return parsePositionSlot(s).code === parsed.code;
    });
  });
}

function computePositionGaps(players, needed, thresholds) {
  return needed.map(function (n) {
    var count = playersMatchingSlot(players, n.slot).length;
    var target = n.count * thresholds.positionDepthMultiplier;
    var severity;
    if (count === 0) severity = 'missing';
    else if (count < n.count) severity = 'thin';
    else if (count < target) severity = 'tight';
    else severity = 'ok';
    return { code: n.slot, count: count, neededStarters: n.count, target: target, severity: severity };
  });
}

// Berechnet für jeden Positions-Slot den Ø der Durchschnittsnote (dieselbe
// Kennzahl, die "Leistung je Position" standardmäßig nutzt) - unabhängig davon,
// welche zusätzlichen Kennzahlen der Nutzer sich dort noch dazu ausgewählt hat,
// da sich die nicht sinnvoll zu einem Wert mischen lassen (siehe performance.js).
function computePositionRatings(players, neededSlots) {
  return sortBySlotOrder(neededSlots.map(function (n) { return n.slot; })).map(function (slot) {
    var relevantPlayers = playersMatchingSlot(players, slot);
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
function computePositionActionItems(gapResults, qualityResults, ratingResults, thresholds) {
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

  // Slot-Universum kommt allein aus den Positionslücken (bereits auf die
  // aktuelle Taktik beschränkt, siehe computePositionGaps) - Qualität und
  // Leistung sind seit der Taktik-Einschränkung ohnehin dieselbe Menge,
  // aber gapResults bleibt die eine verbindliche Quelle.
  var slots = {};
  gapResults.forEach(function (g) { slots[g.code] = true; });

  var items = [];
  Object.keys(slots).forEach(function (slot) {
    var reasons = [];

    var gap = gapResults.filter(function (g) { return g.code === slot; })[0];
    if (gap && gap.severity !== 'ok') {
      if (gap.severity === 'missing') {
        reasons.push('keine Spieler');
      } else if (gap.severity === 'thin') {
        reasons.push('nur ' + gap.count + ' von ' + gap.neededStarters + ' Startern besetzt');
      } else {
        reasons.push('nur ' + gap.count + ' Spieler (Ziel ' + gap.target + ' für Rotation)');
      }
    }

    var quality = qualityByCode[slot];
    if (quality && quality.average != null && qualityMean != null &&
        quality.average <= qualityMean - thresholds.qualityWeakMargin) {
      reasons.push('schwache Qualität (Ø ' + quality.average.toFixed(1) + ')');
    }

    var rating = ratingByCode[slot];
    if (rating && rating.average != null && ratingMean != null &&
        rating.average <= ratingMean - thresholds.ratingWeakMargin) {
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

// Spieler, die auf keiner der aktuell in der Taktik benötigten Positionen
// spielen können - diese tauchen in Positionslücken, Qualität, Leistung und
// Handlungsbedarf sonst nirgends auf, weil diese jetzt alle auf die Taktik
// beschränkt sind. Eigener Hinweis dafür (siehe app.js).
function playersWithoutTacticPosition(players, neededSlots) {
  var matchedIds = {};
  neededSlots.forEach(function (n) {
    playersMatchingSlot(players, n.slot).forEach(function (p) {
      if (p.id != null) matchedIds[p.id] = true;
    });
  });
  return players.filter(function (p) { return p.id == null || !matchedIds[p.id]; });
}
