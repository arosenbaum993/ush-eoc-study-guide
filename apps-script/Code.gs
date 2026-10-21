/**
 * US History EOC results receiver (study guide and quiz).
 *
 * Paste this whole file into Extensions > Apps Script on a Google Sheet, run setup once,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * The same script works for the study guide (index.html) and the quiz (quiz.html).
 * Use a separate Sheet and deployment for each so their Needs Help tabs stay apart.
 *
 * Tabs it builds:
 *   Submissions  every send, unchanged, newest at the bottom
 *   Students     one row per student; the latest send replaces the earlier one
 *   Needs Help   every domain and standard with the students under CUTOFF, lowest first
 */

const CUTOFF = 0.70;

const DOMAINS = [
  "D1 Colonization through the Constitution",
  "D2 New Republic through Reconstruction",
  "D3 Industrialization, Reform, & Imperialism",
  "D4 Establishment as a World Power",
  "D5 Post-World War II to the Present"
];
const STANDARDS = Array.from({length: 23}, (_, i) => "SSUSH" + (i + 1));

const SUB_HEAD = ["Received", "Form", "Last", "First", "Teacher", "Period", "Device", "Total %", "Points",
  "D1", "D2", "D3", "D4", "D5", "Missed questions", "Data"];
const STU_HEAD = ["Last", "First", "Teacher", "Period", "Form", "Last sent", "Times sent", "Total %"]
  .concat(["D1 %", "D2 %", "D3 %", "D4 %", "D5 %"])
  .concat(STANDARDS.map(s => s + " %"))
  .concat(["Missed questions", "Device"]);
const PCT_FIRST = STU_HEAD.indexOf("Total %") + 1;            // first percent column (1-based)
const PCT_LAST = STU_HEAD.indexOf("SSUSH23 %") + 1;           // last percent column (1-based)
const HELP_HEAD = ["Area", "Name", "Under " + Math.round(CUTOFF * 100) + "%", "Not attempted", "Students under " + Math.round(CUTOFF * 100) + "% (lowest first)"];

// ---------- web app ----------
function doGet(e) {
  const params = (e && e.parameter) || {};
  let out;
  try {
    if (!params.p) throw new Error("no results were included");
    record_(JSON.parse(params.p));
    out = {ok: true};
  } catch (err) {
    out = {ok: false, error: String(err && err.message || err).slice(0, 200)};
  }
  const body = JSON.stringify(out);
  const cb = params.cb || "";
  if (/^[A-Za-z_$][\w$]{0,63}$/.test(cb)) {
    return ContentService.createTextOutput(cb + "(" + body + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// ---------- recording ----------
function record_(p) {
  const clean = s => String(s == null ? "" : s).trim().replace(/\s+/g, " ").slice(0, 60);
  const first = clean(p.first), last = clean(p.last), teacher = clean(p.teacher), period = clean(p.period);
  if (!first || !last || !teacher || !period) throw new Error("name, teacher, or class period is missing");
  const form = p.form === "quiz" ? "quiz" : "guide";
  const dom = Array.isArray(p.dom) ? p.dom : [];
  if (dom.length !== 5) throw new Error("the results were not in the expected format");
  const std = p.std && typeof p.std === "object" ? p.std : {};
  const missed = String(p.missed || "").slice(0, 2000);

  const pct = (e, t) => (Number(t) > 0 ? Number(e) / Number(t) : "");
  let te = 0, tp = 0;
  dom.forEach(d => { te += Number(d[0]) || 0; tp += Number(d[1]) || 0; });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error("the sheet is busy, try again in a minute");
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName("Students")) setup();
    const now = new Date();

    ss.getSheetByName("Submissions").appendRow([
      now, form, last, first, teacher, period, clean(p.device), pct(te, tp), te + "/" + tp
    ].concat(dom.map(d => (Number(d[0]) || 0) + "/" + (Number(d[1]) || 0) + " on " + (Number(d[2]) || 0) + " of " + (Number(d[3]) || 0)))
     .concat([missed, JSON.stringify(p).slice(0, 5000)]));

    const sh = ss.getSheetByName("Students");
    const key = r => [r[4], r[0], r[1], teacherKey_(r[2])].map(x => String(x).toLowerCase()).join("|");
    const mine = key([last, first, teacher, period, form]);
    const n = sh.getLastRow();
    const rows = n > 1 ? sh.getRange(2, 1, n - 1, STU_HEAD.length).getValues() : [];
    let at = rows.findIndex(r => key(r) === mine);
    const times = at >= 0 ? (Number(rows[at][6]) || 0) + 1 : 1;
    const row = [last, first, teacher, period, form, now, times, pct(te, tp)]
      .concat(dom.map(d => pct(d[0], d[1])))
      .concat(STANDARDS.map(s => (Array.isArray(std[s]) ? pct(std[s][0], std[s][1]) : "")))
      .concat([missed, clean(p.device)]);
    sh.getRange(at >= 0 ? at + 2 : n + 1, 1, 1, row.length).setValues([row]);

    rebuildNeedsHelp();
  } finally {
    lock.releaseLock();
  }
}

// "Mr. Smith", "smith", and "Smith" count as the same teacher when matching a student's row.
function teacherKey_(t) {
  return String(t).toLowerCase().replace(/\b(mr|mrs|ms|miss|dr|coach)\b\.?/g, "").replace(/[^a-z]/g, "");
}

// ---------- Needs Help ----------
function rebuildNeedsHelp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const st = ss.getSheetByName("Students"), nh = ss.getSheetByName("Needs Help");
  const n = st.getLastRow();
  const rows = n > 1 ? st.getRange(2, 1, n - 1, STU_HEAD.length).getValues() : [];
  const areas = DOMAINS.map((name, i) => [name.slice(0, 2), name.slice(3), STU_HEAD.indexOf("D" + (i + 1) + " %")])
    .concat(STANDARDS.map(s => [s, "", STU_HEAD.indexOf(s + " %")]));
  const out = areas.map(([code, name, col]) => {
    const low = rows.filter(r => r[col] !== "" && Number(r[col]) < CUTOFF).sort((a, b) => a[col] - b[col]);
    const blank = rows.filter(r => r[col] === "").length;
    return [code, name, low.length, blank,
      low.map(r => r[0] + ", " + r[1] + " (" + r[2] + ", P" + r[3] + ") " + Math.round(r[col] * 100) + "%" + (r[4] === "quiz" ? " (quiz)" : "")).join("\n")];
  });
  nh.clearContents();
  nh.getRange(1, 1, 1, HELP_HEAD.length).setValues([HELP_HEAD]).setFontWeight("bold");
  if (out.length) nh.getRange(2, 1, out.length, HELP_HEAD.length).setValues(out);
}

// ---------- setup: run once from the editor, and again after changing CUTOFF ----------
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tab = (name, head) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
    sh.setFrozenRows(1);
    return sh;
  };
  const sub = tab("Submissions", SUB_HEAD);
  sub.getRange(2, SUB_HEAD.indexOf("Total %") + 1, sub.getMaxRows() - 1, 1).setNumberFormat("0%");
  sub.getRange(2, 1, sub.getMaxRows() - 1, 1).setNumberFormat("m/d/yyyy h:mm am/pm");

  const st = tab("Students", STU_HEAD);
  st.setFrozenColumns(2);
  const rows = st.getMaxRows() - 1;
  st.getRange(2, STU_HEAD.indexOf("Last sent") + 1, rows, 1).setNumberFormat("m/d/yyyy h:mm am/pm");
  const pctRange = st.getRange(2, PCT_FIRST, rows, PCT_LAST - PCT_FIRST + 1);
  pctRange.setNumberFormat("0%");
  const a1 = st.getRange(2, PCT_FIRST).getA1Notation();  // relative, so each cell checks itself
  st.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=AND(ISNUMBER(" + a1 + ")," + a1 + "<" + CUTOFF + ")")
      .setBackground("#F4C7C3").setRanges([pctRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=AND(ISNUMBER(" + a1 + ")," + a1 + ">=" + CUTOFF + ")")
      .setBackground("#B7E1CD").setRanges([pctRange]).build()
  ]);

  const nh = tab("Needs Help", HELP_HEAD);
  nh.setColumnWidth(2, 260);
  nh.setColumnWidth(5, 420);
  nh.getRange(1, 5, nh.getMaxRows(), 1).setWrap(true);

  const blank = ss.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  rebuildNeedsHelp();
}

// ---------- optional: run from the editor to check the Sheet, then delete the test rows ----------
function testSubmission() {
  record_({
    v: 1, first: "Test", last: "Student", teacher: "Smith", period: "1", device: "test",
    dom: [[3, 4, 3, 17], [0, 0, 0, 21], [0, 0, 0, 16], [2, 2, 2, 24], [0, 0, 0, 24]],
    std: {SSUSH1: [1, 2], SSUSH2: [2, 2], SSUSH15: [2, 2]},
    missed: "Q2 1b/1c/1d"
  });
}
