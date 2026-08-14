import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  Text,
  Badge,
  Button,
  Spinner,
  Separator,
  Stack,
  HStack,
  VStack,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  Camera,
  CameraOff,
  AlertCircle,
  Play,
  Sparkles,
  Check,
  Printer,
  Upload,
} from "lucide-react";

interface LiveCameraScannerProps {
  backendUrl: string;
  onNewLog: (stage: string, message: string) => void;
  onClearLogs: () => void;
}

interface DiagnosisResult {
  is_crop?: boolean;
  disease: string;
  crop: string;
  scientific_name?: string;
  crop_confidence?: number;
  disease_confidence?: number;
  confidence?: number;
  severity?: string;
  symptoms: string[];
  treatment: string[];
  preventive_measures?: string[];
  expert_rag_advisory?: Array<{
    title: string;
    crop: string;
    content: string;
  }>;
}

export default function LiveCameraScanner({
  backendUrl,
  onNewLog,
  onClearLogs,
}: LiveCameraScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [scanActive, setScanActive] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [fieldNotes, setFieldNotes] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const getDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const video = all.filter((d) => d.kind === "videoinput");
      setDevices(video);
      if (video.length > 0 && !selectedDeviceId)
        setSelectedDeviceId(video[0].deviceId);
    } catch {}
  };

  useEffect(() => {
    getDevices();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setError("");
    setResult(null);
    onClearLogs();
    onNewLog("Webcam", "Requesting camera stream...");
    try {
      if (stream) stopCamera();
      const s = await navigator.mediaDevices.getUserMedia({
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: "environment" },
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setCameraActive(true);
      onNewLog("Webcam", "Camera stream active.");
      getDevices();
    } catch (err: any) {
      setError("Camera access denied or unavailable.");
      onNewLog("Webcam Error", err.message);
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);
    setScanActive(false);
    onNewLog("Webcam", "Camera stream stopped.");
  };

  const handleFallbackCapture = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    onClearLogs();
    onNewLog("Capture", "Processing photo for multimodal AI diagnosis...");
    try {
      const formData = new FormData();
      formData.append("image", file);
      if (fieldNotes.trim()) {
        formData.append("context", fieldNotes.trim());
      }
      const res = await fetch(`${backendUrl}/diagnose`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setResult(data);
      onNewLog("Diagnosis", `${data.disease} (${data.confidence}%)`);
    } catch (err: any) {
      onNewLog("Error", err.message);
      showNotification("Image diagnostic failed.");
    } finally {
      setLoading(false);
    }
  };

  const captureFrameAndDiagnose = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setLoading(true);
    setResult(null);
    setScanActive(true);
    onClearLogs();
    onNewLog("Scanner", "Capturing live frame snapshot...");
    try {
      const v = videoRef.current,
        c = canvasRef.current,
        ctx = c.getContext("2d");
      if (ctx) {
        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 480;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        onNewLog(
          "Scanner",
          "Analyzing leaf pathology via Gemini 2.5 Flash Vision...",
        );
        c.toBlob(async (blob) => {
          ctx.clearRect(0, 0, c.width, c.height);
          c.width = 0;
          c.height = 0;
          if (!blob) {
            setLoading(false);
            setScanActive(false);
            return;
          }
          const formData = new FormData();
          formData.append(
            "image",
            new File([blob], "scan.jpg", { type: "image/jpeg" }),
          );
          if (fieldNotes.trim()) {
            formData.append("context", fieldNotes.trim());
          }
          try {
            const res = await fetch(`${backendUrl}/diagnose`, {
              method: "POST",
              body: formData,
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            setResult(data);
            setScanActive(false);
            onNewLog("Diagnosis", `${data.disease} (${data.confidence}%)`);
          } catch (err: any) {
            onNewLog("Error", err.message);
            setScanActive(false);
            showNotification("Frame diagnostic request failed.");
          } finally {
            setLoading(false);
          }
        }, "image/jpeg");
      }
    } catch (err: any) {
      setLoading(false);
      setScanActive(false);
      onNewLog("Error", err.message);
    }
  };

  return (
    <Box
      minH="100vh"
      bg="gray.50"
      p={{ base: 4, md: 8 }}
      fontFamily="Inter, Roboto, sans-serif"
      color="black"
    >
      {/* Toast Notification */}
      {toastMsg && (
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
          {toastMsg}
        </Box>
      )}

      <Box maxW="1280px" mx="auto">
        {/* Header Bar */}
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="2xl"
          p={{ base: 5, md: 6 }}
          mb={6}
          shadow="xs"
        >
          <Flex
            direction={{ base: "column", md: "row" }}
            justify="space-between"
            align={{ base: "flex-start", md: "center" }}
            gap={4}
          >
            <Box>
              <Flex align="center" gap={3} mb={1}>
                <Box bg="black" color="white" p={2} borderRadius="lg">
                  <Camera size={22} />
                </Box>
                <Heading
                  size="xl"
                  color="black"
                  fontWeight="extrabold"
                  letterSpacing="tight"
                >
                  Live AI Reticle Crop, Leaf & Seed Scanner
                </Heading>
              </Flex>
              <Text fontSize="sm" color="gray.600" mt={1}>
                Real-time crop leaf pathology, seed quality & grain defect diagnostics.
              </Text>
            </Box>

            {cameraActive && devices.length > 1 && (
              <HStack gap={2}>
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  color="gray.500"
                  textTransform="uppercase"
                >
                  Camera Device:
                </Text>
                <select
                  style={{
                    height: "34px",
                    paddingLeft: "10px",
                    paddingRight: "10px",
                    borderRadius: "6px",
                    border: "1px solid #000000",
                    backgroundColor: "#ffffff",
                    color: "#000000",
                    fontSize: "12px",
                    fontWeight: 600,
                    outline: "none",
                  }}
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    startCamera();
                  }}
                >
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </HStack>
            )}
          </Flex>
        </Box>

        {/* Main Grid */}
        <Grid
          templateColumns={{ base: "1fr", lg: "7fr 5fr" }}
          gap={6}
          alignContent="start"
        >
          {/* Left Column: Camera Viewport */}
          <GridItem>
            <Stack gap={4}>
              <Box
                position="relative"
                width="100%"
                aspectRatio={16 / 9}
                bg="black"
                borderWidth="2px"
                borderColor="black"
                borderRadius="2xl"
                overflow="hidden"
                shadow="md"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: cameraActive ? "block" : "none",
                  }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />

                {/* Reticle Targeting Frame Overlay */}
                {cameraActive && !result && (
                  <Box
                    position="absolute"
                    inset={0}
                    borderWidth="24px"
                    borderColor="rgba(0,0,0,0.4)"
                    pointerEvents="none"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Box
                      width="200px"
                      height="200px"
                      borderWidth="2px"
                      borderStyle="dashed"
                      borderColor="rgba(255,255,255,0.7)"
                      borderRadius="2xl"
                      position="relative"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Box
                        position="absolute"
                        top="-2px"
                        left="-2px"
                        width="16px"
                        height="16px"
                        borderTopWidth="3px"
                        borderLeftWidth="3px"
                        borderColor="white"
                      />
                      <Box
                        position="absolute"
                        top="-2px"
                        right="-2px"
                        width="16px"
                        height="16px"
                        borderTopWidth="3px"
                        borderRightWidth="3px"
                        borderColor="white"
                      />
                      <Box
                        position="absolute"
                        bottom="-2px"
                        left="-2px"
                        width="16px"
                        height="16px"
                        borderBottomWidth="3px"
                        borderLeftWidth="3px"
                        borderColor="white"
                      />
                      <Box
                        position="absolute"
                        bottom="-2px"
                        right="-2px"
                        width="16px"
                        height="16px"
                        borderBottomWidth="3px"
                        borderRightWidth="3px"
                        borderColor="white"
                      />
                      <Badge
                        bg="black"
                        color="white"
                        px={3}
                        py={1}
                        borderRadius="full"
                        fontSize="10px"
                        fontWeight="bold"
                        letterSpacing="wider"
                      >
                        ALIGN CROP LEAF
                      </Badge>
                    </Box>
                  </Box>
                )}

                {/* Scanner Laser Animation Bar */}
                {scanActive && (
                  <Box
                    position="absolute"
                    left={0}
                    right={0}
                    top={0}
                    height="3px"
                    bg="white"
                    boxShadow="0 0 12px #ffffff"
                    className="animate-scanner-laser"
                  />
                )}

                {/* Offline State Card */}
                {/* Additional Field Notes Input */}
                <Box mb={4} p={3} bg="gray.900" borderRadius="xl" border="1px solid #333">
                  <Text fontSize="10px" color="gray.400" fontWeight="bold" textTransform="uppercase" mb={1.5}>
                    📝 Additional Field Notes / Context (Optional):
                  </Text>
                  <input
                    type="text"
                    placeholder="e.g. Leaves turned yellow 3 days ago after heavy rainfall..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #444",
                      backgroundColor: "#18181b",
                      color: "#ffffff",
                      fontSize: "12px",
                      outline: "none"
                    }}
                    value={fieldNotes}
                    onChange={(e) => setFieldNotes(e.target.value)}
                  />
                </Box>

                {!cameraActive && (
                  <Box textAlign="center" p={8} maxW="360px">
                    <CameraOff
                      size={44}
                      color="#71717a"
                      style={{ margin: "0 auto 16px" }}
                    />
                    <Heading size="sm" color="white" fontWeight="bold" mb={1}>
                      Webcam Reticle Scanner Offline
                    </Heading>
                    <Text
                      fontSize="xs"
                      color="gray.400"
                      mb={6}
                      lineHeight="relaxed"
                    >
                      Start your camera to perform real-time AI pathology
                      diagnostic scans on crop leaves.
                    </Text>
                    <Button
                      onClick={startCamera}
                      bg="white"
                      color="black"
                      _hover={{ bg: "gray.200" }}
                      width="100%"
                      size="sm"
                      height="40px"
                      fontWeight="bold"
                      mb={4}
                    >
                      <Play
                        size={16}
                        style={{ marginRight: 8, fill: "black" }}
                      />{" "}
                      Start Live Reticle Camera
                    </Button>

                    <Separator mb={4} borderColor="gray.800" />

                    <Text
                      fontSize="10px"
                      color="gray.500"
                      fontWeight="bold"
                      textTransform="uppercase"
                      mb={2}
                    >
                      Or Upload Field Leaf Photo
                    </Text>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      ref={fallbackInputRef}
                      onChange={handleFallbackCapture}
                    />
                    <Button
                      onClick={() => fallbackInputRef.current?.click()}
                      variant="outline"
                      borderColor="gray.700"
                      color="white"
                      _hover={{ bg: "gray.900" }}
                      width="100%"
                      size="sm"
                      height="36px"
                    >
                      <Upload size={14} style={{ marginRight: 6 }} /> Select
                      Leaf Image File
                    </Button>
                  </Box>
                )}

                {/* Loading State Overlay */}
                {loading && (
                  <Box
                    position="absolute"
                    inset={0}
                    bg="rgba(0, 0, 0, 0.85)"
                    backdropFilter="blur(4px)"
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    color="white"
                  >
                    <Spinner size="xl" color="white" mb={3} />
                    <Heading size="xs" color="white" fontWeight="bold">
                      Analyzing Leaf Pathology Telemetry...
                    </Heading>
                    <Text
                      fontSize="10px"
                      color="gray.400"
                      mt={1}
                      letterSpacing="widest"
                      textTransform="uppercase"
                    >
                      Gemini 2.5 Flash Vision Multimodal
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Action Controls Toolbar */}
              {cameraActive && (
                <Flex gap={3}>
                  <Button
                    onClick={stopCamera}
                    variant="outline"
                    borderColor="gray.300"
                    color="black"
                    bg="white"
                    _hover={{ bg: "gray.100" }}
                    flex="1"
                    size="sm"
                    height="40px"
                  >
                    <CameraOff size={16} style={{ marginRight: 6 }} /> Stop
                    Camera
                  </Button>
                  <Button
                    onClick={captureFrameAndDiagnose}
                    disabled={loading}
                    bg="black"
                    color="white"
                    _hover={{ bg: "gray.800" }}
                    flex="2"
                    size="sm"
                    height="40px"
                    fontWeight="bold"
                  >
                    <Sparkles size={16} style={{ marginRight: 6 }} /> Capture &
                    Diagnose Leaf
                  </Button>
                </Flex>
              )}

              {error && (
                <Box
                  p={4}
                  borderWidth="1px"
                  borderColor="black"
                  bg="white"
                  borderRadius="xl"
                  display="flex"
                  alignItems="center"
                  gap={3}
                >
                  <AlertCircle size={18} color="black" />
                  <Text fontSize="xs" color="black" fontWeight="semibold">
                    {error}
                  </Text>
                </Box>
              )}
            </Stack>
          </GridItem>

          {/* Right Column: Diagnostic Pathology Report */}
          <GridItem>
            {!result ? (
              <Box
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="2xl"
                p={8}
                minH="420px"
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                textAlign="center"
                shadow="xs"
              >
                <Camera
                  size={44}
                  color="#a1a1aa"
                  style={{ marginBottom: 16 }}
                />
                <Heading size="sm" color="black" fontWeight="bold" mb={1}>
                  Diagnostic Pathology Report
                </Heading>
                <Text
                  fontSize="xs"
                  color="gray.500"
                  maxW="260px"
                  lineHeight="relaxed"
                >
                  Capture a crop leaf image via webcam reticle or upload a photo
                  to generate a real-time diagnostic report.
                </Text>
              </Box>
            ) : (
              <Box
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="2xl"
                p={{ base: 5, md: 6 }}
                shadow="xs"
              >
                <Flex
                  align="center"
                  justify="space-between"
                  mb={4}
                  pb={3}
                  borderBottom="1px solid"
                  borderColor="gray.200"
                >
                  <Box>
                    <Text
                      fontSize="10px"
                      fontWeight="bold"
                      color="gray.500"
                      textTransform="uppercase"
                      letterSpacing="wider"
                    >
                      Diagnostic Pathology Report
                    </Text>
                    <Heading
                      size="lg"
                      color="black"
                      fontWeight="extrabold"
                      mt={0.5}
                    >
                      {result.disease}
                    </Heading>
                  </Box>
                  <HStack gap={2}>
                    {result.severity && (
                      <Badge
                        bg={
                          result.severity === "Severe"
                            ? "red.600"
                            : result.severity === "Moderate"
                            ? "orange.500"
                            : "emerald.600"
                        }
                        color="white"
                        fontSize="xs"
                        fontWeight="bold"
                        px={2.5}
                        py={1}
                        borderRadius="md"
                      >
                        {result.severity}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      borderColor="black"
                      color="black"
                      fontSize="xs"
                      fontWeight="bold"
                      px={3}
                      py={1}
                    >
                      {result.disease_confidence || result.confidence || 90}% Diagnosis
                    </Badge>
                  </HStack>
                </Flex>

                <SimpleGrid columns={2} gap={3} mb={5}>
                  <Box
                    bg="emerald.50"
                    p={3.5}
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="emerald.200"
                  >
                    <Text
                      fontSize="10px"
                      color="emerald.800"
                      fontWeight="bold"
                      textTransform="uppercase"
                    >
                      Target Crop ({result.crop_confidence || 95}% Match)
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="extrabold"
                      color="emerald.950"
                      mt={0.5}
                    >
                      {result.crop}
                    </Text>
                    {result.scientific_name && (
                      <Text fontSize="11px" fontStyle="italic" color="emerald.700" mt={0.5}>
                        {result.scientific_name}
                      </Text>
                    )}
                  </Box>
                  <Box
                    bg="gray.50"
                    p={3.5}
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="gray.200"
                  >
                    <Text
                      fontSize="10px"
                      color="gray.500"
                      fontWeight="bold"
                      textTransform="uppercase"
                    >
                      Vision AI Engine
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color="black"
                      mt={0.5}
                    >
                      Gemini 2.5 / Groq 90B
                    </Text>
                  </Box>
                </SimpleGrid>

                {/* Symptoms */}
                <Box mb={5}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color="black"
                    textTransform="uppercase"
                    mb={2}
                  >
                    Observed Symptoms
                  </Text>
                  <VStack align="stretch" gap={1.5}>
                    {result.symptoms.map((s, i) => (
                      <Text
                        key={i}
                        fontSize="xs"
                        color="gray.700"
                        lineHeight="relaxed"
                      >
                        • {s}
                      </Text>
                    ))}
                  </VStack>
                </Box>

                {/* Treatment */}
                <Box pt={4} borderTop="1px solid" borderColor="gray.200" mb={5}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color="black"
                    textTransform="uppercase"
                    mb={2}
                  >
                    Recommended Actionable Treatment
                  </Text>
                  <VStack align="stretch" gap={2}>
                    {result.treatment.map((t, i) => (
                      <Box
                        key={i}
                        bg="gray.50"
                        p={3}
                        borderRadius="lg"
                        borderWidth="1px"
                        borderColor="gray.200"
                      >
                        <Text
                          fontSize="xs"
                          color="black"
                          fontWeight="semibold"
                          lineHeight="relaxed"
                        >
                          {i + 1}. {t}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                </Box>

                {/* RAG Extension Manual Context (if returned) */}
                {result.expert_rag_advisory && result.expert_rag_advisory.length > 0 && (
                  <Box pt={4} borderTop="1px solid" borderColor="gray.200" mb={6}>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color="emerald.800"
                      textTransform="uppercase"
                      mb={2}
                    >
                      📚 Verified Vector Manual Advice (ChromaDB)
                    </Text>
                    <VStack align="stretch" gap={2}>
                      {result.expert_rag_advisory.map((manual, i) => (
                        <Box
                          key={i}
                          bg="emerald.50"
                          p={3}
                          borderRadius="lg"
                          borderWidth="1px"
                          borderColor="emerald.200"
                        >
                          <Text fontSize="xs" fontWeight="bold" color="emerald.900" mb={0.5}>
                            {manual.title} ({manual.crop})
                          </Text>
                          <Text fontSize="11px" color="emerald.950" lineHeight="relaxed">
                            {manual.content}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                )}

                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  borderColor="black"
                  color="black"
                  _hover={{ bg: "black", color: "white" }}
                  width="100%"
                  size="sm"
                  height="40px"
                  fontWeight="bold"
                >
                  <Printer size={16} style={{ marginRight: 8 }} /> Print
                  Diagnostic Report
                </Button>
              </Box>
            )}
          </GridItem>
        </Grid>
      </Box>
    </Box>
  );
}
