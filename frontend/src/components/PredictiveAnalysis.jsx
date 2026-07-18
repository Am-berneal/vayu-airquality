import { useState, useEffect } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Wind, Thermometer, Flame, TrendingUp, TrendingDown, Minus, Radio } from "lucide-react";

function TrendIcon({ trend }) {
  if (trend === "Rising" || trend === "Increasing") {
    return <TrendingUp size={14} className="text-red-500" />;
  }
  if (trend === "Falling" || trend === "Decreasing") {
    return <TrendingDown size={14} className="text-blue-500" />;
  }
  return <Minus size={14} className="text-gray-400" />;
}

function PredictiveAnalysis({ areaLabel, baselineAQI, isMonitored }) {
  const [forecast, setForecast] = useState([]);
  const [insight, setInsight] = useState("");
  const [factors, setFactors] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scrubHour, setScrubHour] = useState(0);

  useEffect(() => {
    if (!areaLabel || baselineAQI == null) return;

    setLoading(true);
    setScrubHour(0);

    fetch(`http://127.0.0.1:8000/weather?city=Chandigarh`)
      .then((res) => res.json())
      .then((weather) => {
        return fetch("http://127.0.0.1:8000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            area: areaLabel,
            baseline_aqi: baselineAQI,
            wind_speed: weather.wind_speed ?? 3,
            wind_deg: weather.wind_direction ?? 0,
            temperature: weather.temperature ?? 28,
            is_monitored: isMonitored,
          }),
        });
      })
      .then((res) => res.json())
      .then((data) => {
        setForecast(data.forecast.map((f) => ({ ...f, range: [f.low, f.high] })));
        setInsight(data.insight);
        setFactors(data.factors);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Prediction fetch failed:", err);
        setLoading(false);
      });
  }, [areaLabel, baselineAQI, isMonitored]);

  if (!areaLabel) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Predictive Analysis</h2>
        <p className="text-sm text-gray-400 mb-6">
          24-hour AQI forecast and AI-driven insights for your district.
        </p>
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Select a State, District, and Area from the dropdowns above to see its forecast.
        </div>
      </div>
    );
  }

  const scrubPoint = forecast[scrubHour];

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Predictive Analysis</h2>
      <p className="text-sm text-gray-400 mb-1">
        24-hour AQI forecast and AI-driven insights for {areaLabel}.
      </p>
      {!isMonitored && (
        <p className="text-xs text-amber-600 mb-4">
          ⓘ No live sensor here — baseline estimated via inverse-distance interpolation from nearby monitoring stations.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-6 mt-4">
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-800">AQI Forecast</h3>
            <span className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-medium px-2.5 py-1 rounded-full">
              <Radio size={12} /> Live Sync
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">Next 24 Hours</p>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              Generating forecast...
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="time_label"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    interval={Math.max(0, Math.floor(forecast.length / 5) - 1)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area dataKey="range" stroke="none" fill="#0d9488" fillOpacity={0.12} isAnimationActive={false} />
                  <Line
                    type="monotone"
                    dataKey="predicted_aqi"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <ReferenceLine x={forecast[0]?.time_label} stroke="#dc2626" strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="mt-4">
                <input
                  type="range"
                  min={0}
                  max={forecast.length - 1}
                  value={scrubHour}
                  onChange={(e) => setScrubHour(parseInt(e.target.value))}
                  className="w-full accent-teal-700"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Now</span>
                  <span>6h</span>
                  <span>12h</span>
                  <span>18h</span>
                  <span>24h</span>
                </div>
                {scrubPoint && (
                  <p className="text-sm text-gray-600 mt-2 text-center">
                    At <strong>{scrubPoint.time_label}</strong>: predicted AQI{" "}
                    <strong className="text-teal-700">{scrubPoint.predicted_aqi}</strong>{" "}
                    (range {scrubPoint.low}–{scrubPoint.high})
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-teal-50 text-teal-700 p-2 rounded-lg">
                <Radio size={16} />
              </div>
              <h3 className="font-semibold text-gray-800">AI Insight</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {loading ? "Analyzing conditions..." : insight}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Key Influencing Factors</h3>
            {factors && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-600">
                    <Wind size={15} /> Wind Speed
                  </span>
                  <span className="flex items-center gap-1 font-medium text-gray-700">
                    <TrendIcon trend={factors.wind_trend} /> {factors.wind_trend}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-600">
                    <Thermometer size={15} /> Temperature
                  </span>
                  <span className="flex items-center gap-1 font-medium text-gray-700">
                    <TrendIcon trend={factors.temp_trend} /> {factors.temp_trend}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-600">
                    <Flame size={15} /> Local Burning
                  </span>
                  <span className="flex items-center gap-1 font-medium text-gray-700">
                    <TrendIcon trend={factors.burning_trend} /> {factors.burning_trend}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PredictiveAnalysis;