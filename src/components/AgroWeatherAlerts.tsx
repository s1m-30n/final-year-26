import { useState, useEffect } from "react";

interface AgroWeatherAlertsProps {
  backendUrl: string;
}

interface WeatherData {
  region: string;
  state: string;
  temp_c: number;
  condition: string;
  humidity: number;
  rain_chance: number;
  wind_kmh: number;
  uv_index: number;
  agro_advisory: string;
  forecast: { day: string; temp: string; condition: string; rain: string; advice: string }[];
}

interface AlertItem {
  id: string;
  type: string;
  priority: string;
  title: string;
  title_pidgin: string;
  category: string;
  region: string;
  timestamp: string;
  message_en: string;
  message_pidgin: string;
  action: string;
}

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

export default function AgroWeatherAlerts({ backendUrl }: AgroWeatherAlertsProps) {
  const [selectedRegion, setSelectedRegion] = useState("Oyo");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usePidgin, setUsePidgin] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsDetecting, setGpsDetecting] = useState(false);

  const fetchWeather = async (region: string) => {
    try {
      const res = await fetch(`${backendUrl}/weather?region=${region}`);
      if (res.ok) setWeather(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWeatherByCoords = async (lat: number, lon: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/weather?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
        setGpsLocation({ lat, lon });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectGPS = () => {
    if ("geolocation" in navigator) {
      setGpsDetecting(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsDetecting(false);
          fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          setGpsDetecting(false);
          alert("GPS detection failed or permission denied. Select your state from the dropdown.");
        },
        { timeout: 10000 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${backendUrl}/alerts`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setLoading(true);
    setGpsLocation(null);
    Promise.all([fetchWeather(selectedRegion), fetchAlerts()]).finally(() => setLoading(false));
  }, [selectedRegion, backendUrl]);

  const triggerSimulatedPushNotification = (alert: AlertItem) => {
    const msg = usePidgin ? alert.message_pidgin : alert.message_en;
    setToastMessage(`Push Alert Broadcasted: "${alert.title}"`);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`${alert.title}`, { body: msg });
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
    setTimeout(() => setToastMessage(null), 4500);
  };

  return (
    <div>

      {/* Toast */}
      {toastMessage && (
        <div>
          <p>{toastMessage}</p>
        </div>
      )}

      {/* Page Header */}
      <div>
        <div>
          <h2>Agro-Weather &amp; 36 States GPS Hub</h2>
          <p>Live satellite forecasts · All 36 Nigerian States + FCT · Open-Meteo APIs</p>
        </div>

        <div>
          <button onClick={handleDetectGPS} disabled={gpsDetecting}>
            {gpsDetecting
              ? "Detecting…"
              : gpsLocation
              ? `${gpsLocation.lat.toFixed(2)}°, ${gpsLocation.lon.toFixed(2)}°`
              : "Detect My GPS"}
          </button>

          <div>
            <label htmlFor="state-select">State:</label>
            <select
              id="state-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
            >
              {NIGERIAN_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <button onClick={() => setUsePidgin(!usePidgin)}>
            {usePidgin ? "Pidgin" : "English"}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div>
          <p>Loading satellite weather data…</p>
        </div>
      ) : (
        <div>

          {/* Weather Dashboard */}
          <div>
            {weather && (
              <div>

                {/* Current Conditions */}
                <div>
                  <div>
                    <p>Live Satellite · {weather.state}</p>
                    <h3>{weather.region}</h3>
                    <p>{weather.condition}</p>
                  </div>
                  <div>
                    <span>{weather.temp_c}°C</span>
                    <span>Air Temperature</span>
                  </div>
                </div>

                {/* KPI Grid */}
                <div>
                  <div>
                    <p>Humidity</p>
                    <strong>{weather.humidity}%</strong>
                  </div>
                  <div>
                    <p>Rain Chance</p>
                    <strong>{weather.rain_chance}%</strong>
                  </div>
                  <div>
                    <p>Wind</p>
                    <strong>{weather.wind_kmh} km/h</strong>
                  </div>
                  <div>
                    <p>UV Index</p>
                    <strong>{weather.uv_index}/10</strong>
                  </div>
                </div>

                {/* AI Advisory */}
                <div>
                  <p><strong>Smart AI Agronomic Advisory</strong></p>
                  <p>{weather.agro_advisory}</p>
                </div>

                {/* 5-Day Forecast */}
                <div>
                  <h4>5-Day Agro-Weather Forecast</h4>
                  <div>
                    {weather.forecast.map((item, i) => (
                      <div key={i}>
                        <div>
                          <span>{item.day}</span>
                          <span>{item.temp}</span>
                        </div>
                        <p>{item.condition}</p>
                        <div>
                          <p><strong>Field Action</strong></p>
                          <p>{item.advice}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Alerts Panel */}
          <div>
            <div>
              <h3>Push Alert Broadcast ({alerts.length})</h3>
              <span>Live Gateway</span>
            </div>

            <div>
              {alerts.map((alert) => (
                <div key={alert.id}>
                  <div>
                    <h4>{usePidgin ? alert.title_pidgin : alert.title}</h4>
                    <span>{alert.priority.toUpperCase()}</span>
                  </div>

                  <p>{usePidgin ? alert.message_pidgin : alert.message_en}</p>

                  <div>
                    <div>
                      <span>{alert.category}</span>
                      <span>{alert.timestamp}</span>
                    </div>
                    <button onClick={() => triggerSimulatedPushNotification(alert)}>
                      Push Alert
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* SMS Gateway */}
            <div>
              <h5>PWA Push &amp; SMS Gateway</h5>
              <p>Active · Nationwide Coverage</p>
              <p>
                Emergency push alerts are delivered automatically to field extension workers' phones
                and broadcasted over SMS to 2G-compatible devices.
              </p>
            </div>

            {/* Priority Legend */}
            <div>
              <span>Priority:</span>
              <span>Urgent</span>
              <span>High</span>
              <span>Medium</span>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
