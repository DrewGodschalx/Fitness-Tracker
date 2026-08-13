import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const CORE_FIELDS = [
  { key: "weight", label: "Weight", unit: "kg" },
  { key: "height", label: "Height", unit: "cm" },
  { key: "waist", label: "Waist", unit: "cm" },
  { key: "neck", label: "Neck", unit: "cm" },
];

const LIMB_GROUPS = [
  { key: "bicep", label: "Bicep" },
  { key: "forearm", label: "Forearm" },
  { key: "thigh", label: "Thigh" },
  { key: "calf", label: "Calf" },
];

const MACRO_DEFS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

const TREND_GROUPS = [
  {
    label: "Body",
    options: [
      { key: "weight", label: "Weight" },
      { key: "bmi", label: "BMI" },
      { key: "waist", label: "Waist" },
      { key: "neck", label: "Neck" },
    ],
  },
  {
    label: "Limbs",
    options: [
      { key: "bicep_l", label: "Bicep L" },
      { key: "bicep_r", label: "Bicep R" },
      { key: "forearm_l", label: "Forearm L" },
      { key: "forearm_r", label: "Forearm R" },
      { key: "thigh_l", label: "Thigh L" },
      { key: "thigh_r", label: "Thigh R" },
      { key: "calf_l", label: "Calf L" },
      { key: "calf_r", label: "Calf R" },
    ],
  },
  {
    label: "Macros",
    options: [
      { key: "calories", label: "Calories" },
      { key: "protein", label: "Protein" },
      { key: "carbs", label: "Carbs" },
      { key: "fat", label: "Fat" },
    ],
  },
];

const ACTIVITY_LEVELS = [
  { key: "sedentary", label: "Sedentary (little/no exercise)", mult: 1.2 },
  { key: "light", label: "Light (1-3 days/week)", mult: 1.375 },
  { key: "moderate", label: "Moderate (3-5 days/week)", mult: 1.55 },
  { key: "active", label: "Active (6-7 days/week)", mult: 1.725 },
  { key: "very_active", label: "Very active (physical job + training)", mult: 1.9 },
];

const GOALS = [
  { key: "cut", label: "Cut", calAdjust: -0.2, proteinPerKg: 2.2 },
  { key: "recomp", label: "Recomp", calAdjust: 0, proteinPerKg: 2.0 },
  { key: "bulk", label: "Bulk", calAdjust: 0.12, proteinPerKg: 1.8 },
];

const MET_TABLE = [
  { speed: 3.2, met: 2.8 },
  { speed: 4.0, met: 3.0 },
  { speed: 4.8, met: 3.3 },
  { speed: 5.5, met: 3.6 },
  { speed: 6.4, met: 4.3 },
  { speed: 7.2, met: 6.0 },
  { speed: 8.0, met: 8.3 },
  { speed: 9.7, met: 9.8 },
  { speed: 10.8, met: 10.5 },
  { speed: 11.3, met: 11.0 },
  { speed: 12.1, met: 11.5 },
  { speed: 12.9, met: 12.3 },
  { speed: 13.8, met: 12.8 },
  { speed: 14.5, met: 14.5 },
  { speed: 16.1, met: 16.0 },
  { speed: 17.5, met: 19.0 },
  { speed: 19.3, met: 19.8 },
  { speed: 21.0, met: 23.0 },
];

const ENTRIES_KEY = "bodylog:entries";
const PROFILE_KEY = "bodylog:profile";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  const f = { date: todayISO() };
  CORE_FIELDS.forEach((d) => (f[d.key] = ""));
  LIMB_GROUPS.forEach((g) => {
    f[`${g.key}_l`] = "";
    f[`${g.key}_r`] = "";
  });
  MACRO_DEFS.forEach((d) => (f[d.key] = ""));
  return f;
}

function navyBodyFat(waist, neck, height) {
  if (!waist || !neck || !height || waist <= neck) return null;
  const val =
    495 /
      (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) -
    450;
  if (!isFinite(val) || val <= 0 || val > 70) return null;
  return val;
}

function computeBMI(weight, heightCm) {
  if (!weight || !heightCm) return null;
  const h = heightCm / 100;
  const bmi = weight / (h * h);
  if (!isFinite(bmi) || bmi <= 0) return null;
  return bmi;
}

function bmiCategory(bmi) {
  if (bmi === null) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function metForSpeed(speedKmh) {
  if (speedKmh <= MET_TABLE[0].speed) return MET_TABLE[0].met;
  const last = MET_TABLE[MET_TABLE.length - 1];
  if (speedKmh >= last.speed) return last.met;
  for (let i = 0; i < MET_TABLE.length - 1; i++) {
    const a = MET_TABLE[i];
    const b = MET_TABLE[i + 1];
    if (speedKmh >= a.speed && speedKmh <= b.speed) {
      const frac = (speedKmh - a.speed) / (b.speed - a.speed);
      return a.met + frac * (b.met - a.met);
    }
  }
  return last.met;
}

function round(n, d = 1) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return null;
  const f = Math.pow(10, d);
  return Math.round(Number(n) * f) / f;
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const C = {
  bg: "#181F2E",
  panel: "#1F2940",
  panelAlt: "#232E47",
  ink: "#EDE7D6",
  inkDim: "#A9AC9C",
  brass: "#C9973F",
  brassDim: "#8E6C2E",
  rust: "#BE6A4A",
  sage: "#8BA37E",
  grid: "rgba(237,231,214,0.08)",
  line: "rgba(237,231,214,0.14)",
};

export default function BodyMacroTracker() {
  const [entries, setEntries] = useState([]);
  const [profile, setProfile] = useState({
    sex: "male",
    age: "",
    activity: "moderate",
    goal: "recomp",
  });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("log");
  const [form, setForm] = useState(emptyForm());
  const [status, setStatus] = useState("");
  const [trendMetric, setTrendMetric] = useState("weight");
  const [burnInputs, setBurnInputs] = useState({ distance: "", pace: "", weight: "" });

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(ENTRIES_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setEntries(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {}
      try {
        const p = await window.storage.get(PROFILE_KEY, false);
        if (p && p.value) setProfile(JSON.parse(p.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  async function persistEntries(next) {
    setEntries(next);
    try {
      await window.storage.set(ENTRIES_KEY, JSON.stringify(next), false);
    } catch (e) {
      flash("Could not save. Try again.");
    }
  }

  async function persistProfile(next) {
    setProfile(next);
    try {
      await window.storage.set(PROFILE_KEY, JSON.stringify(next), false);
    } catch (e) {}
  }

  function flash(msg) {
    setStatus(msg);
    setTimeout(() => setStatus(""), 2200);
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveEntry() {
    if (!form.date) return flash("Pick a date first.");
    const allKeys = [
      ...CORE_FIELDS.map((d) => d.key),
      ...LIMB_GROUPS.flatMap((g) => [`${g.key}_l`, `${g.key}_r`]),
      ...MACRO_DEFS.map((d) => d.key),
    ];
    const hasAny = allKeys.some((k) => form[k] !== "" && form[k] !== undefined);
    if (!hasAny) return flash("Enter at least one value.");
    const entry = { id: `${form.date}-${Date.now()}`, ...form };
    const next = [...entries.filter((e) => e.date !== form.date), entry].sort((a, b) =>
      a.date < b.date ? -1 : 1
    );
    await persistEntries(next);
    flash("Entry logged.");
    const carryHeight = form.height;
    setForm({ ...emptyForm(), height: carryHeight });
  }

  async function deleteEntry(id) {
    await persistEntries(entries.filter((e) => e.id !== id));
  }

  const latest = entries.length ? entries[entries.length - 1] : null;

  const chartData = useMemo(() => {
    return entries.map((e) => {
      const bmi = computeBMI(Number(e.weight) || null, Number(e.height) || null);
      const row = {
        date: fmtDate(e.date),
        bmi: bmi ? round(bmi, 1) : null,
      };
      [...CORE_FIELDS.map((d) => d.key), ...MACRO_DEFS.map((d) => d.key)].forEach((k) => {
        row[k] = e[k] ? Number(e[k]) : null;
      });
      LIMB_GROUPS.forEach((g) => {
        row[`${g.key}_l`] = e[`${g.key}_l`] ? Number(e[`${g.key}_l`]) : null;
        row[`${g.key}_r`] = e[`${g.key}_r`] ? Number(e[`${g.key}_r`]) : null;
      });
      return row;
    });
  }, [entries]);

  const previewWaist = Number(form.waist) || Number(latest?.waist) || 0;
  const previewNeck = Number(form.neck) || Number(latest?.neck) || 0;
  const previewHeight = Number(form.height) || Number(latest?.height) || 0;
  const previewWeight = form.weight || latest?.weight || "";
  const previewBF = navyBodyFat(previewWaist, previewNeck, previewHeight);
  const previewBMI = computeBMI(Number(previewWeight) || null, previewHeight || null);

  // ---- Macro suggestion calc ----
  const macroWeight = Number(form.weight) || Number(latest?.weight) || 0;
  const macroHeight = Number(form.height) || Number(latest?.height) || 0;
  const macroAge = Number(profile.age) || 0;
  const activity = ACTIVITY_LEVELS.find((a) => a.key === profile.activity) || ACTIVITY_LEVELS[2];
  const goal = GOALS.find((g) => g.key === profile.goal) || GOALS[1];
  let bmr = null;
  if (macroWeight && macroHeight && macroAge) {
    bmr =
      10 * macroWeight +
      6.25 * macroHeight -
      5 * macroAge +
      (profile.sex === "male" ? 5 : -161);
  }
  const tdee = bmr ? bmr * activity.mult : null;
  const targetCalories = tdee ? tdee * (1 + goal.calAdjust) : null;
  let macroPlan = null;
  if (targetCalories && macroWeight) {
    const proteinG = goal.proteinPerKg * macroWeight;
    const proteinKcal = proteinG * 4;
    const fatKcal = targetCalories * 0.25;
    const fatG = fatKcal / 9;
    const carbsKcal = Math.max(targetCalories - proteinKcal - fatKcal, 0);
    const carbsG = carbsKcal / 4;
    macroPlan = { proteinG, fatG, carbsG, calories: targetCalories };
  }

  // ---- Calorie burn calc ----
  const burnDistance = Number(burnInputs.distance) || 0;
  const burnPace = Number(burnInputs.pace) || 0;
  const burnWeight = Number(burnInputs.weight) || Number(latest?.weight) || 0;
  let burnResult = null;
  if (burnDistance > 0 && burnPace > 0 && burnWeight > 0) {
    const speedKmh = 60 / burnPace;
    const timeHours = burnDistance / speedKmh;
    const met = metForSpeed(speedKmh);
    const calories = met * burnWeight * timeHours;
    burnResult = { speedKmh, timeHours, met, calories };
  }

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        background: C.bg,
        color: C.ink,
        borderRadius: 14,
        maxWidth: 780,
        margin: "0 auto",
        overflow: "hidden",
        border: `1px solid ${C.line}`,
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
      />
      <style>{`
        .blueprint-grid {
          background-image:
            linear-gradient(${C.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${C.grid} 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .num-input, .sel-input {
          font-family: 'IBM Plex Mono', monospace;
          background: ${C.panelAlt};
          border: 1px solid ${C.line};
          color: ${C.ink};
          border-radius: 6px;
          padding: 8px 10px;
          width: 100%;
          font-size: 14px;
          box-sizing: border-box;
        }
        .sel-input { font-family: 'Inter', sans-serif; }
        .num-input:focus, .sel-input:focus { outline: none; border-color: ${C.brass}; }
        .field-label {
          font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
          color: ${C.inkDim}; margin-bottom: 5px; display: block;
        }
        .section-label {
          font-family: 'Oswald', sans-serif; font-size: 12px; letter-spacing: 0.06em;
          text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid ${C.line};
          padding-bottom: 6px;
        }
        .tab-btn {
          font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 0.05em;
          font-size: 12.5px; background: transparent; border: none; color: ${C.inkDim};
          padding: 13px 14px; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap;
        }
        .tab-btn.active { color: ${C.brass}; border-bottom: 2px solid ${C.brass}; }
        .save-btn {
          font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 0.05em;
          background: ${C.brass}; color: #241A08; border: none; border-radius: 6px;
          padding: 11px 20px; font-size: 13px; font-weight: 500; cursor: pointer;
        }
        .save-btn:hover { background: #D6A652; }
        .ghost-btn {
          background: transparent; border: 1px solid ${C.line}; color: ${C.inkDim};
          border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer;
        }
        .ghost-btn:hover { border-color: ${C.rust}; color: ${C.rust}; }
        .limb-row { display: grid; grid-template-columns: 84px 1fr 1fr; align-items: center; gap: 8px; margin-bottom: 8px; }
        .limb-name { font-size: 12px; color: ${C.inkDim}; }
        .spec-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
      `}</style>

      <div className="blueprint-grid" style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, letterSpacing: "0.03em", textTransform: "uppercase" }}>
              Field Log
            </div>
            <div style={{ fontSize: 12, color: C.inkDim, marginTop: 2 }}>Body measurements &amp; macro tracking</div>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.brassDim, textAlign: "right" }}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"} logged
          </div>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, padding: "0 20px", overflowX: "auto" }}>
        {[
          { id: "log", label: "Log" },
          { id: "macros", label: "Suggested macros" },
          { id: "burn", label: "Calorie burn" },
          { id: "trends", label: "Trends" },
          { id: "history", label: "History" },
        ].map((t) => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "22px 24px 26px" }}>
        {!loaded && <div style={{ color: C.inkDim, fontSize: 13 }}>Loading your log&hellip;</div>}

        {loaded && tab === "log" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 28 }}>
            <div>
              <div style={{ marginBottom: 16 }}>
                <span className="field-label">Date</span>
                <input type="date" className="num-input" value={form.date} onChange={(e) => updateField("date", e.target.value)} style={{ maxWidth: 180 }} />
              </div>

              <div className="section-label" style={{ color: C.brass }}>Core</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {CORE_FIELDS.map((d) => (
                  <div key={d.key}>
                    <span className="field-label">{d.label} <span style={{ opacity: 0.6 }}>({d.unit})</span></span>
                    <input type="number" inputMode="decimal" className="num-input" placeholder="0.0" value={form[d.key]} onChange={(e) => updateField(d.key, e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="section-label" style={{ color: C.brass }}>Limbs (left / right, cm)</div>
              <div style={{ marginBottom: 20 }}>
                <div className="limb-row" style={{ marginBottom: 4 }}>
                  <span></span>
                  <span className="field-label" style={{ textAlign: "center" }}>Left</span>
                  <span className="field-label" style={{ textAlign: "center" }}>Right</span>
                </div>
                {LIMB_GROUPS.map((g) => (
                  <div className="limb-row" key={g.key}>
                    <span className="limb-name">{g.label}</span>
                    <input type="number" inputMode="decimal" className="num-input" placeholder="0.0" value={form[`${g.key}_l`]} onChange={(e) => updateField(`${g.key}_l`, e.target.value)} />
                    <input type="number" inputMode="decimal" className="num-input" placeholder="0.0" value={form[`${g.key}_r`]} onChange={(e) => updateField(`${g.key}_r`, e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="section-label" style={{ color: C.sage }}>Macros</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {MACRO_DEFS.map((d) => (
                  <div key={d.key}>
                    <span className="field-label">{d.label} <span style={{ opacity: 0.6 }}>({d.unit})</span></span>
                    <input type="number" inputMode="decimal" className="num-input" placeholder="0" value={form[d.key]} onChange={(e) => updateField(d.key, e.target.value)} />
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button className="save-btn" onClick={saveEntry}>Log entry</button>
                {status && <span style={{ fontSize: 12, color: C.inkDim }}>{status}</span>}
              </div>
            </div>

            <div>
              <div className="section-label" style={{ color: C.inkDim, border: "none" }}>Spec sheet</div>
              <div className="blueprint-grid" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 14px" }}>
                <BodyDiagram waist={previewWaist} neck={previewNeck} brass={C.brass} ink={C.ink} />
                <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                  <div className="spec-row"><span style={{ color: C.inkDim }}>Weight</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{previewWeight ? `${previewWeight} kg` : "--"}</span></div>
                  <div className="spec-row"><span style={{ color: C.inkDim }}>BMI</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{previewBMI ? `${round(previewBMI, 1)} · ${bmiCategory(previewBMI)}` : "--"}</span></div>
                  <div className="spec-row"><span style={{ color: C.inkDim }}>Est. body fat</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.brass }}>{previewBF ? `${round(previewBF, 1)}%` : "--"}</span></div>
                </div>
                <div style={{ marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                  {LIMB_GROUPS.map((g) => {
                    const l = form[`${g.key}_l`] || latest?.[`${g.key}_l`] || "--";
                    const r = form[`${g.key}_r`] || latest?.[`${g.key}_r`] || "--";
                    return (
                      <div className="spec-row" key={g.key}>
                        <span style={{ color: C.inkDim }}>{g.label}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{l} / {r} cm</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: C.inkDim, marginTop: 10, lineHeight: 1.4 }}>
                  Body fat is a US Navy method estimate (waist, neck, height) — approximate, not clinical.
                </div>
              </div>
            </div>
          </div>
        )}

        {loaded && tab === "macros" && (
          <div style={{ maxWidth: 480 }}>
            <div className="section-label" style={{ color: C.sage }}>Your profile</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <span className="field-label">Sex</span>
                <select className="sel-input" value={profile.sex} onChange={(e) => persistProfile({ ...profile, sex: e.target.value })}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <span className="field-label">Age</span>
                <input type="number" className="num-input" placeholder="30" value={profile.age} onChange={(e) => persistProfile({ ...profile, age: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span className="field-label">Activity level</span>
                <select className="sel-input" value={profile.activity} onChange={(e) => persistProfile({ ...profile, activity: e.target.value })}>
                  {ACTIVITY_LEVELS.map((a) => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span className="field-label">Goal</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {GOALS.map((g) => (
                    <button
                      key={g.key}
                      className="ghost-btn"
                      style={
                        profile.goal === g.key
                          ? { background: C.brass, color: "#241A08", borderColor: C.brass }
                          : {}
                      }
                      onClick={() => persistProfile({ ...profile, goal: g.key })}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: C.inkDim, marginBottom: 16 }}>
              Uses your most recent logged weight ({macroWeight || "--"} kg) and height ({macroHeight || "--"} cm). Log an entry first if these look empty.
            </div>

            {!macroPlan ? (
              <EmptyState text="Enter your age, and make sure weight and height are logged, to see suggested targets." />
            ) : (
              <div className="blueprint-grid" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 16px" }}>
                <div className="spec-row" style={{ fontSize: 13 }}>
                  <span style={{ color: C.inkDim }}>Maintenance (TDEE)</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{round(tdee, 0)} kcal</span>
                </div>
                <div className="spec-row" style={{ fontSize: 14, borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 4 }}>
                  <span style={{ color: C.brass }}>Target calories ({goal.label.toLowerCase()})</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.brass }}>{round(macroPlan.calories, 0)} kcal</span>
                </div>
                <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10 }}>
                  <div className="spec-row"><span style={{ color: C.inkDim }}>Protein</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{round(macroPlan.proteinG, 0)} g</span></div>
                  <div className="spec-row"><span style={{ color: C.inkDim }}>Carbs</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{round(macroPlan.carbsG, 0)} g</span></div>
                  <div className="spec-row"><span style={{ color: C.inkDim }}>Fat</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{round(macroPlan.fatG, 0)} g</span></div>
                </div>
                <div style={{ fontSize: 10, color: C.inkDim, marginTop: 10, lineHeight: 1.4 }}>
                  BMR via Mifflin-St Jeor, scaled by activity level. Cut is roughly 20% below maintenance, bulk about 12% above, recomp at maintenance. Protein is set per kg bodyweight, fat at 25% of calories, carbs fill the rest. Adjust based on how your weight trend actually responds.
                </div>
              </div>
            )}
          </div>
        )}

        {loaded && tab === "burn" && (
          <div style={{ maxWidth: 460 }}>
            <div className="section-label" style={{ color: C.sage }}>Run / walk calorie estimate</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <span className="field-label">Distance (km)</span>
                <input type="number" inputMode="decimal" className="num-input" placeholder="5.0" value={burnInputs.distance} onChange={(e) => setBurnInputs({ ...burnInputs, distance: e.target.value })} />
              </div>
              <div>
                <span className="field-label">Pace (min / km)</span>
                <input type="number" inputMode="decimal" className="num-input" placeholder="6.0" value={burnInputs.pace} onChange={(e) => setBurnInputs({ ...burnInputs, pace: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span className="field-label">Bodyweight (kg) <span style={{ opacity: 0.6 }}>optional — defaults to latest log</span></span>
                <input type="number" inputMode="decimal" className="num-input" placeholder={latest?.weight || "70"} value={burnInputs.weight} onChange={(e) => setBurnInputs({ ...burnInputs, weight: e.target.value })} />
              </div>
            </div>

            {!burnResult ? (
              <EmptyState text="Enter a distance and pace to estimate calories burned." />
            ) : (
              <div className="blueprint-grid" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 16px" }}>
                <div className="spec-row"><span style={{ color: C.inkDim }}>Speed</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{round(burnResult.speedKmh, 1)} km/h</span></div>
                <div className="spec-row"><span style={{ color: C.inkDim }}>Duration</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{round(burnResult.timeHours * 60, 0)} min</span></div>
                <div className="spec-row"><span style={{ color: C.inkDim }}>Estimated MET</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{round(burnResult.met, 1)}</span></div>
                <div className="spec-row" style={{ fontSize: 14, borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 4 }}>
                  <span style={{ color: C.brass }}>Calories burned</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.brass }}>{round(burnResult.calories, 0)} kcal</span>
                </div>
                <div style={{ fontSize: 10, color: C.inkDim, marginTop: 10, lineHeight: 1.4 }}>
                  Estimate from MET tables for walking/running at this speed. Actual burn varies with terrain, fitness, and individual efficiency.
                </div>
              </div>
            )}
          </div>
        )}

        {loaded && tab === "trends" && (
          <div>
            {entries.length === 0 ? (
              <EmptyState text="Log a few entries to see trends over time." />
            ) : (
              <>
                <div style={{ marginBottom: 18, maxWidth: 260 }}>
                  <select className="sel-input" value={trendMetric} onChange={(e) => setTrendMetric(e.target.value)}>
                    {TREND_GROUPS.map((grp) => (
                      <optgroup label={grp.label} key={grp.label}>
                        {grp.options.map((o) => (
                          <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke={C.inkDim} fontSize={11} tickLine={false} />
                      <YAxis stroke={C.inkDim} fontSize={11} tickLine={false} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.ink }} />
                      <Line type="monotone" dataKey={trendMetric} stroke={C.brass} strokeWidth={2} dot={{ r: 3, fill: C.brass }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {loaded && tab === "history" && (
          <div>
            {entries.length === 0 ? (
              <EmptyState text="No entries yet. Log your first measurement to build your history." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                      {["Date", "Weight", "Waist", "BMI", "Cal", "Protein", "Carbs", "Fat", ""].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 8px", color: C.inkDim, fontFamily: "'Oswald', sans-serif", fontWeight: 400, textTransform: "uppercase", fontSize: 10.5, letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...entries].reverse().map((e) => {
                      const bmi = computeBMI(Number(e.weight) || null, Number(e.height) || null);
                      return (
                        <tr key={e.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                          <td style={{ padding: "8px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(e.date)}</td>
                          <td style={{ padding: "8px 8px" }}>{e.weight || "--"}</td>
                          <td style={{ padding: "8px 8px" }}>{e.waist || "--"}</td>
                          <td style={{ padding: "8px 8px" }}>{bmi ? round(bmi, 1) : "--"}</td>
                          <td style={{ padding: "8px 8px" }}>{e.calories || "--"}</td>
                          <td style={{ padding: "8px 8px" }}>{e.protein || "--"}</td>
                          <td style={{ padding: "8px 8px" }}>{e.carbs || "--"}</td>
                          <td style={{ padding: "8px 8px" }}>{e.fat || "--"}</td>
                          <td style={{ padding: "8px 8px" }}><button className="ghost-btn" onClick={() => deleteEntry(e.id)}>Delete</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize: 10.5, color: C.inkDim, marginTop: 8 }}>
                  Limb measurements aren't shown here to keep the table readable — view them per-date in Trends.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ border: "1px dashed rgba(237,231,214,0.14)", borderRadius: 10, padding: "32px 20px", textAlign: "center", color: "#A9AC9C", fontSize: 13 }}>
      {text}
    </div>
  );
}

function BodyDiagram({ waist, neck, brass, ink }) {
  return (
    <svg viewBox="0 0 200 240" width="100%" height="200">
      <ellipse cx="100" cy="28" rx="17" ry="19" fill="none" stroke={ink} strokeWidth="1.4" opacity="0.7" />
      <line x1="62" y1="52" x2="138" y2="52" stroke={ink} strokeWidth="1.4" opacity="0.5" />
      <path d="M70,52 L64,135 L74,210 L92,210 L95,145 L105,145 L108,210 L126,210 L136,135 L130,52 Z" fill="none" stroke={ink} strokeWidth="1.4" opacity="0.7" />
      <line x1="55" y1="56" x2="34" y2="140" stroke={ink} strokeWidth="1.2" opacity="0.5" />
      <line x1="145" y1="56" x2="166" y2="140" stroke={ink} strokeWidth="1.2" opacity="0.5" />

      <line x1="65" y1="55" x2="135" y2="55" stroke={brass} strokeWidth="1.5" strokeDasharray="3,2" />
      <text x="140" y="58" fontSize="10" fill={brass} fontFamily="IBM Plex Mono, monospace">
        neck {neck ? `${neck}cm` : "--"}
      </text>

      <line x1="61" y1="100" x2="139" y2="100" stroke={brass} strokeWidth="1.5" strokeDasharray="3,2" />
      <text x="140" y="104" fontSize="10" fill={brass} fontFamily="IBM Plex Mono, monospace">
        waist {waist ? `${waist}cm` : "--"}
      </text>
    </svg>
  );
}
