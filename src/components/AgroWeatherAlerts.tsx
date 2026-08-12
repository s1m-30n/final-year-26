import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  Text,
  Badge,
  Spinner,
  Stack,
  HStack,
  VStack,
  SimpleGrid,
} from "@chakra-ui/react";
import { CloudSun, Bell, MapPin, Radio, Compass, Check } from "lucide-react";

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
  forecast: {
    day: string;
    temp: string;
    condition: string;
    rain: string;
    advice: string;
  }[];
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" px={4} py={3} bg="white" shadow="xs">
      <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
        {label}
      </Text>
      <Text fontSize="xl" fontWeight="black" color="black" mt={0.5}>
        {value}
      </Text>
    </Box>
  );
}

function ForecastCard({ item }: { item: WeatherData["forecast"][number] }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={4} bg="white" minW="140px" shadow="xs">
      <Flex justify="space-between" align="center" mb={1}>
        <Text fontWeight="bold" fontSize="sm" color="black">
          {item.day}
        </Text>
        <Text fontWeight="extrabold" fontSize="sm" color="black">
          {item.temp}
        </Text>
      </Flex>
      <Text fontSize="xs" color="gray.600" mb={3}>
        {item.condition}
      </Text>
      <Box bg="gray.50" borderWidth="1px" borderColor="gray.200" borderRadius="lg" p={2.5}>
        <Text fontSize="10px" fontWeight="bold" color="gray.500" textTransform="uppercase" mb={0.5}>
          Field Advisory
        </Text>
        <Text fontSize="xs" color="black" lineHeight="snug">
          {item.advice}
        </Text>
      </Box>
    </Box>
  );
}

function AlertCard({ alert, usePidgin, onPush }: { alert: AlertItem; usePidgin: boolean; onPush: (a: AlertItem) => void }) {
  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      p={5}
      bg="white"
      shadow="xs"
      transition="all 0.15s ease-in-out"
      _hover={{ borderColor: "black" }}
    >
      <Flex justify="space-between" align="center" mb={2} wrap="wrap" gap={2}>
        <HStack gap={2}>
          <Badge variant="outline" borderColor="black" color="black" fontSize="10px" fontWeight="bold" px={2} py={0.5}>
            {alert.priority.toUpperCase()}
          </Badge>
          <Text fontSize="xs" fontWeight="semibold" color="gray.500">
            {alert.region}
          </Text>
        </HStack>
        <Badge variant="outline" borderColor="gray.300" color="gray.600" fontSize="10px">
          {alert.type}
        </Badge>
      </Flex>

      <Heading size="xs" color="black" fontWeight="extrabold" mb={2}>
        {usePidgin ? alert.title_pidgin : alert.title}
      </Heading>

      <Text fontSize="xs" color="gray.700" mb={3} lineHeight="relaxed">
        {usePidgin ? alert.message_pidgin : alert.message_en}
      </Text>

      <Flex justify="space-between" align="center" wrap="wrap" gap={2} borderTop="1px solid" borderColor="gray.100" pt={3}>
        <Flex gap={2} align="center" wrap="wrap">
          <Badge variant="outline" borderColor="gray.300" color="gray.700" fontSize="10px">
            {alert.category}
          </Badge>
          <Text fontSize="10px" color="gray.400">
            {alert.timestamp}
          </Text>
        </Flex>

        <Button
          size="xs"
          variant="outline"
          borderColor="black"
          color="black"
          onClick={() => onPush(alert)}
          _hover={{ bg: "black", color: "white" }}
          height="26px"
        >
          <Radio size={12} style={{ marginRight: 4 }} /> Push Alert
        </Button>
      </Flex>
    </Box>
  );
}

export default function AgroWeatherAlerts({ backendUrl }: AgroWeatherAlertsProps) {
  const [selectedRegion, setSelectedRegion] = useState("Oyo");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usePidgin, setUsePidgin] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsDetecting, setGpsDetecting] = useState(false);

  const fetchWeather = async (regionName: string) => {
    try {
      const res = await fetch(`${backendUrl}/weather/${encodeURIComponent(regionName)}`);
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWeatherByCoords = async (lat: number, lon: number) => {
    try {
      const res = await fetch(`${backendUrl}/weather/coords?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
        setGpsLocation({ lat, lon });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDetectGPS = () => {
    if (!("geolocation" in navigator)) {
      alert("Geolocation not supported on this device.");
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsDetecting(false);
        fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGpsDetecting(false);
        alert("GPS detection failed. Please select your state from the dropdown.");
      },
      { timeout: 10000 }
    );
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

  const triggerPush = (alert: AlertItem) => {
    const msg = usePidgin ? alert.message_pidgin : alert.message_en;
    setToastMessage(`Broadcasted Push Alert: "${alert.title}"`);
    if ("Notification" in window) {
      if (Notification.permission === "granted") new Notification(alert.title, { body: msg });
      else if (Notification.permission !== "denied") Notification.requestPermission();
    }
    setTimeout(() => setToastMessage(null), 4500);
  };

  return (
    <Box minH="100vh" bg="gray.50" p={{ base: 4, md: 8 }} fontFamily="Inter, Roboto, sans-serif" color="black">
      {/* Toast Notification */}
      {toastMessage && (
        <Box
          position="fixed"
          top={4}
          right={4}
          zIndex={9999}
          bg="black"
          color="white"
          px={5}
          py={3}
          borderRadius="lg"
          boxShadow="2xl"
          fontSize="sm"
          fontWeight="medium"
          display="flex"
          alignItems="center"
          gap={2}
        >
          <Check size={16} />
          {toastMessage}
        </Box>
      )}

      <Box maxW="1280px" mx="auto">
        {/* Page Header */}
        <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" p={{ base: 5, md: 6 }} mb={6} shadow="xs">
          <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} gap={4} wrap="wrap">
            <Box>
              <Flex align="center" gap={3} mb={1}>
                <Box bg="black" color="white" p={2} borderRadius="lg">
                  <CloudSun size={22} />
                </Box>
                <Heading size="xl" color="black" fontWeight="extrabold" letterSpacing="tight">
                  Agro-Weather & Emergency Push Alerts Hub
                </Heading>
              </Flex>
              <Text fontSize="sm" color="gray.600" mt={1}>
                Live satellite weather feeds across all 36 Nigerian States + FCT, paired with real-time field emergency push alerts.
              </Text>
            </Box>

            <Flex gap={3} align="center" wrap="wrap">
              <Button
                size="sm"
                variant="outline"
                borderColor="black"
                color="black"
                onClick={handleDetectGPS}
                disabled={gpsDetecting}
                _hover={{ bg: "black", color: "white" }}
                height="36px"
                px={4}
              >
                <Compass size={14} style={{ marginRight: 6 }} />
                {gpsDetecting
                  ? "Detecting GPS..."
                  : gpsLocation
                  ? `${gpsLocation.lat.toFixed(2)}°, ${gpsLocation.lon.toFixed(2)}°`
                  : "Detect My GPS"}
              </Button>

              <select
                style={{
                  height: "36px",
                  width: "160px",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  borderRadius: "6px",
                  border: "1px solid #d4d4d8",
                  backgroundColor: "#ffffff",
                  color: "#000000",
                  fontSize: "14px",
                  fontWeight: 500,
                  outline: "none",
                }}
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
              >
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s} State
                  </option>
                ))}
              </select>

              <Button
                size="sm"
                variant={usePidgin ? "solid" : "outline"}
                bg={usePidgin ? "black" : "white"}
                color={usePidgin ? "white" : "black"}
                borderColor="black"
                onClick={() => setUsePidgin(!usePidgin)}
                _hover={{ bg: "black", color: "white" }}
                height="36px"
                px={4}
              >
                {usePidgin ? "Pidgin Mode: ON" : "English Dialect"}
              </Button>
            </Flex>
          </Flex>
        </Box>

        {/* Loading State */}
        {loading ? (
          <Box py={20} textAlign="center" bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl">
            <Spinner size="lg" color="black" mb={3} />
            <Text color="black" fontWeight="medium" fontSize="sm">
              Loading satellite weather feeds & field alerts...
            </Text>
          </Box>
        ) : (
          <Grid templateColumns={{ base: "1fr", lg: "1fr 380px" }} gap={6}>
            {/* Left Column: Weather Feed */}
            <GridItem>
              {weather && (
                <Stack gap={5}>
                  {/* Weather Hero Card */}
                  <Box bg="black" borderRadius="2xl" p={6} color="white" shadow="md">
                    <Flex justify="space-between" align="flex-start" wrap="wrap" gap={4}>
                      <Box>
                        <Flex align="center" gap={2} mb={1}>
                          <MapPin size={14} color="#a1a1aa" />
                          <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                            Live Satellite Feed · {weather.state}
                          </Text>
                        </Flex>
                        <Heading size="2xl" fontWeight="black" mt={1} mb={1}>
                          {weather.region}
                        </Heading>
                        <Text color="gray.300" fontSize="sm">
                          {weather.condition}
                        </Text>
                      </Box>
                      <Box textAlign="right">
                        <Text fontSize="5xl" fontWeight="black" lineHeight="1">
                          {weather.temp_c}°C
                        </Text>
                        <Text fontSize="xs" color="gray.400" mt={1}>
                          Air Temperature
                        </Text>
                      </Box>
                    </Flex>
                  </Box>

                  {/* Weather KPI Grid */}
                  <SimpleGrid columns={{ base: 2, sm: 4 }} gap={4}>
                    <StatCard label="Rain Chance" value={`${weather.rain_chance}%`} />
                    <StatCard label="Air Humidity" value={`${weather.humidity}%`} />
                    <StatCard label="Wind Speed" value={`${weather.wind_kmh} km/h`} />
                    <StatCard label="UV Index" value={`${weather.uv_index}`} />
                  </SimpleGrid>

                  {/* Extension Advisory Box */}
                  <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" p={5} shadow="xs">
                    <Heading size="xs" color="black" fontWeight="extrabold" textTransform="uppercase" mb={2} letterSpacing="wider">
                      Extension Weather Advisory
                    </Heading>
                    <Text fontSize="xs" color="gray.700" lineHeight="relaxed">
                      {weather.agro_advisory}
                    </Text>
                  </Box>

                  {/* 5-Day Forecast Carousel/Row */}
                  <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" p={5} shadow="xs">
                    <Heading size="xs" color="black" fontWeight="extrabold" textTransform="uppercase" mb={4} letterSpacing="wider">
                      5-Day Field Forecast & Advisory
                    </Heading>
                    <Flex gap={3} overflowX="auto" pb={2}>
                      {weather.forecast?.map((item, idx) => (
                        <ForecastCard key={idx} item={item} />
                      ))}
                    </Flex>
                  </Box>
                </Stack>
              )}
            </GridItem>

            {/* Right Column: Emergency Field Push Alerts */}
            <GridItem>
              <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" p={5} shadow="xs" height="100%">
                <Flex align="center" justify="space-between" mb={4} pb={3} borderBottom="1px solid" borderColor="gray.100">
                  <Flex align="center" gap={2}>
                    <Box bg="black" color="white" p={1.5} borderRadius="md">
                      <Bell size={16} />
                    </Box>
                    <Heading size="sm" color="black" fontWeight="extrabold">
                      Active Emergency Alerts
                    </Heading>
                  </Flex>
                  <Badge variant="outline" borderColor="black" color="black" fontSize="xs">
                    {alerts.length} Broadcasts
                  </Badge>
                </Flex>

                <VStack align="stretch" gap={4}>
                  {alerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} usePidgin={usePidgin} onPush={triggerPush} />
                  ))}
                </VStack>
              </Box>
            </GridItem>
          </Grid>
        )}
      </Box>
    </Box>
  );
}
