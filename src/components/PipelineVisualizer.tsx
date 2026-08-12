import { useState } from "react";
import {
  Box,
  Flex,
  Grid,
  Heading,
  Text,
  Badge,
  Button,
  Separator,
  Stack,
  HStack,
  VStack,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  Languages,
  Cpu,
  Hourglass,
  Wifi,
  Terminal,
  Activity,
  Zap,
  Copy,
  Check,
  Signal,
  ArrowDownUp,
} from "lucide-react";

interface PipelineVisualizerProps {
  logs: { stage: string; message: string }[];
  originalQuery: string;
  translatedQuery: string;
  englishResponse: string;
  finalResponse: string;
  retrievedDocs: { title: string; score: number; content: string }[];
  currentLanguage: string;
  pipelineMode: "pivot" | "direct";
}

type NetworkType = "2g" | "3g" | "4g" | "5g";

const NETWORK_PROFILES: Record<
  NetworkType,
  {
    id: NetworkType;
    name: string;
    operator: string;
    speedKbps: number;
    speedLabel: string;
    rttMs: number;
    rttLabel: string;
    packetLoss: string;
    payloadOptimization: string;
    estLatencyDirect: string;
    estLatencyPivot: string;
  }
> = {
  "2g": {
    id: "2g",
    name: "2G EDGE (Rural Nigeria)",
    operator: "MTN / Airtel 2G Rural Cell",
    speedKbps: 50,
    speedLabel: "50 kbps",
    rttMs: 950,
    rttLabel: "950 ms",
    packetLoss: "4.2%",
    payloadOptimization: "Brotli + Gzip (78% compression) + 384px Canvas",
    estLatencyDirect: "2.1s",
    estLatencyPivot: "4.4s",
  },
  "3g": {
    id: "3g",
    name: "3G HSPA+ (Suburban Hubs)",
    operator: "Airtel / Glo 3G Network",
    speedKbps: 2400,
    speedLabel: "2.4 Mbps",
    rttMs: 220,
    rttLabel: "220 ms",
    packetLoss: "1.1%",
    payloadOptimization: "Gzip JSON + 512px WebP Image format",
    estLatencyDirect: "1.1s",
    estLatencyPivot: "2.3s",
  },
  "4g": {
    id: "4g",
    name: "4G LTE (State Capitals)",
    operator: "MTN / Glo 4G LTE",
    speedKbps: 25000,
    speedLabel: "25 Mbps",
    rttMs: 45,
    rttLabel: "45 ms",
    packetLoss: "<0.2%",
    payloadOptimization: "Standard JSON Gzip Stream",
    estLatencyDirect: "0.5s",
    estLatencyPivot: "1.1s",
  },
  "5g": {
    id: "5g",
    name: "5G / Fiber (Urban Extension Center)",
    operator: "MTN 5G / Broadbased Fiber",
    speedKbps: 120000,
    speedLabel: "120 Mbps",
    rttMs: 18,
    rttLabel: "18 ms",
    packetLoss: "0.0%",
    payloadOptimization: "Uncompressed Raw Real-time Stream",
    estLatencyDirect: "0.3s",
    estLatencyPivot: "0.6s",
  },
};

export default function PipelineVisualizer({
  logs,
  originalQuery,
  translatedQuery,
  englishResponse,
  finalResponse,
  retrievedDocs,
  currentLanguage,
  pipelineMode,
}: PipelineVisualizerProps) {
  const [networkProfile, setNetworkProfile] = useState<NetworkType>("2g");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showNotification(`Copied ${label} to clipboard!`);
  };

  // Dynamic telemetry calculations
  const rawPayloadString =
    (originalQuery || "") +
    (translatedQuery || "") +
    (englishResponse || "") +
    (finalResponse || "") +
    retrievedDocs.map((d) => d.title + d.content).join("");

  const rawPayloadBytes = new Blob([rawPayloadString]).size || 128;
  const compressedPayloadBytes = Math.max(48, Math.round(rawPayloadBytes * 0.28));

  const activeProfile = NETWORK_PROFILES[networkProfile];
  const estimatedTransferMs = Math.round(
    (compressedPayloadBytes * 8 * 1000) / (activeProfile.speedKbps * 1000) + activeProfile.rttMs
  );

  return (
    <Box minH="100vh" bg="gray.50" p={{ base: 4, md: 8 }} fontFamily="Inter, Roboto, sans-serif" color="black">
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
        {/* Top Header Card */}
        <Flex
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "stretch", md: "center" }}
          gap={4}
          mb={6}
          pb={6}
          borderBottom="1px solid"
          borderColor="gray.200"
        >
          <Box>
            <Flex align="center" gap={3} mb={1}>
              <Box bg="black" color="white" p={2} borderRadius="lg">
                <Cpu size={22} />
              </Box>
              <Heading size="xl" color="black" fontWeight="extrabold" letterSpacing="tight">
                Pipeline Trace & Field Telemetry Simulator
              </Heading>
              <Badge
                variant="outline"
                borderColor="black"
                color="black"
                px={2.5}
                py={0.5}
                fontSize="xs"
                fontWeight="bold"
                borderRadius="full"
              >
                {pipelineMode === "direct" ? "Direct Native RAG" : "Pivot Translation RAG"}
              </Badge>
            </Flex>
            <Text color="gray.600" fontSize="sm" mt={1}>
              Real-time translation telemetry, vector similarity metrics, 2G field bandwidth profiles, and execution logs.
            </Text>
          </Box>

          <HStack gap={3} flexWrap="wrap">
            <Badge
              variant="outline"
              borderColor="gray.300"
              color="gray.800"
              px={3}
              py={1.5}
              borderRadius="lg"
              fontSize="xs"
              fontWeight="semibold"
              display="flex"
              alignItems="center"
              gap={1.5}
            >
              <Languages size={14} />
              {currentLanguage} ⇄ English
            </Badge>
          </HStack>
        </Flex>

        {/* Network Field Bandwidth Profile Simulator Card */}
        <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" p={{ base: 5, md: 6 }} mb={8} shadow="xs">
          <Flex direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "flex-start", md: "center" }} gap={4} mb={6}>
            <Flex align="center" gap={3}>
              <Box bg="black" color="white" p={2.5} borderRadius="xl">
                <Wifi size={20} />
              </Box>
              <Box>
                <Heading size="md" color="black" fontWeight="extrabold">
                  Field Network Bandwidth Profile Simulator
                </Heading>
                <Text fontSize="xs" color="gray.600" mt={0.5}>
                  Simulate low-bandwidth telecom performance across rural Nigerian cell towers.
                </Text>
              </Box>
            </Flex>

            {/* Profile Selection Pills */}
            <Flex gap={2} flexWrap="wrap">
              {(Object.keys(NETWORK_PROFILES) as NetworkType[]).map((key) => {
                const prof = NETWORK_PROFILES[key];
                const isActive = networkProfile === key;
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={isActive ? "solid" : "outline"}
                    bg={isActive ? "black" : "white"}
                    color={isActive ? "white" : "black"}
                    borderColor={isActive ? "black" : "gray.300"}
                    _hover={{ bg: isActive ? "gray.800" : "gray.100" }}
                    onClick={() => setNetworkProfile(key)}
                    borderRadius="lg"
                    px={3.5}
                    height="34px"
                    fontSize="xs"
                    fontWeight={isActive ? "bold" : "medium"}
                  >
                    {prof.name.split(" ")[0]} ({prof.speedLabel})
                  </Button>
                );
              })}
            </Flex>
          </Flex>

          <Separator mb={5} borderColor="gray.100" />

          {/* Telemetry Metrics Grid */}
          <SimpleGrid columns={{ base: 2, lg: 4 }} gap={4}>
            <Box bg="gray.50" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200">
              <Flex align="center" justify="space-between" mb={1}>
                <Text fontSize="10px" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                  Bandwidth Speed
                </Text>
                <Signal size={14} color="#71717a" />
              </Flex>
              <Text fontSize="xl" fontWeight="black" color="black">
                {activeProfile.speedLabel}
              </Text>
              <Text fontSize="xs" color="gray.500" mt={0.5}>
                {activeProfile.operator}
              </Text>
            </Box>

            <Box bg="gray.50" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200">
              <Flex align="center" justify="space-between" mb={1}>
                <Text fontSize="10px" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                  RTT Latency
                </Text>
                <Activity size={14} color="#71717a" />
              </Flex>
              <Text fontSize="xl" fontWeight="black" color="black">
                {activeProfile.rttLabel}
              </Text>
              <Text fontSize="xs" color="gray.500" mt={0.5}>
                Packet Loss: {activeProfile.packetLoss}
              </Text>
            </Box>

            <Box bg="gray.50" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200">
              <Flex align="center" justify="space-between" mb={1}>
                <Text fontSize="10px" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                  Payload Compression
                </Text>
                <ArrowDownUp size={14} color="#71717a" />
              </Flex>
              <Text fontSize="xl" fontWeight="black" color="black">
                {compressedPayloadBytes} B
              </Text>
              <Text fontSize="xs" color="gray.500" mt={0.5} truncate title={activeProfile.payloadOptimization}>
                {rawPayloadBytes} B uncompressed
              </Text>
            </Box>

            <Box bg="gray.50" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200">
              <Flex align="center" justify="space-between" mb={1}>
                <Text fontSize="10px" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                  Est. Total Latency
                </Text>
                <Zap size={14} color="#71717a" />
              </Flex>
              <Text fontSize="xl" fontWeight="black" color="black">
                {pipelineMode === "direct" ? activeProfile.estLatencyDirect : activeProfile.estLatencyPivot}
              </Text>
              <Text fontSize="xs" color="gray.500" mt={0.5}>
                ~{estimatedTransferMs} ms over-the-air
              </Text>
            </Box>
          </SimpleGrid>
        </Box>

        {/* Pipeline Execution Stages */}
        {logs.length === 0 ? (
          <Box py={16} textAlign="center" bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" shadow="xs">
            <Hourglass size={40} color="#a1a1aa" style={{ margin: "0 auto 12px" }} />
            <Heading size="sm" color="black" mb={1}>
              No Active Pipeline Trace Log
            </Heading>
            <Text color="gray.500" fontSize="xs" maxW="md" mx="auto" mb={4}>
              Submit an advisory query in the Chat Assistant tab to trace live NLLB translation, vector retrieval, and LLM synthesis.
            </Text>
          </Box>
        ) : (
          <Stack gap={6}>
            <Heading size="md" color="black" fontWeight="extrabold">
              Pipeline Stage Trace Analysis
            </Heading>

            {/* Stage 1 Card */}
            <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} shadow="xs">
              <Flex align="center" justify="space-between" mb={4} pb={3} borderBottom="1px solid" borderColor="gray.100">
                <Flex align="center" gap={2}>
                  <Badge variant="outline" borderColor="black" color="black" fontSize="xs" px={2} py={0.5}>
                    Stage 1
                  </Badge>
                  <Heading size="sm" color="black" fontWeight="bold">
                    Input Translation (NLLB-200)
                  </Heading>
                </Flex>

                {pipelineMode === "direct" ? (
                  <Badge variant="outline" borderColor="gray.400" color="gray.600" fontSize="xs">
                    Bypassed in Direct Dialect Mode
                  </Badge>
                ) : (
                  <Badge variant="outline" borderColor="black" color="black" fontSize="xs">
                    NLLB Active
                  </Badge>
                )}
              </Flex>

              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                <Box bg="gray.50" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.200">
                  <Text fontSize="10px" fontWeight="bold" color="gray.500" textTransform="uppercase" mb={1}>
                    Source Input ({currentLanguage})
                  </Text>
                  <Text fontSize="xs" color="black" fontWeight="medium" lineHeight="relaxed">
                    {originalQuery ? `"${originalQuery}"` : "Awaiting input..."}
                  </Text>
                </Box>

                <Box bg="gray.50" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.200">
                  <Text fontSize="10px" fontWeight="bold" color="gray.500" textTransform="uppercase" mb={1}>
                    {pipelineMode === "direct" ? "Matched Dialect Keyword" : "Target Standard (English)"}
                  </Text>
                  <Text fontSize="xs" color="black" fontWeight="medium" lineHeight="relaxed">
                    {translatedQuery ? `"${translatedQuery}"` : "Awaiting translation output..."}
                  </Text>
                </Box>
              </Grid>
            </Box>

            {/* Stage 2 Card */}
            <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} shadow="xs">
              <Flex align="center" justify="space-between" mb={4} pb={3} borderBottom="1px solid" borderColor="gray.100">
                <Flex align="center" gap={2}>
                  <Badge variant="outline" borderColor="black" color="black" fontSize="xs" px={2} py={0.5}>
                    Stage 2
                  </Badge>
                  <Heading size="sm" color="black" fontWeight="bold">
                    ChromaDB Vector Retrieval
                  </Heading>
                </Flex>
                <Badge variant="outline" borderColor="black" color="black" fontSize="xs">
                  {retrievedDocs.length} Chunks Retrieved
                </Badge>
              </Flex>

              {retrievedDocs.length === 0 ? (
                <Text fontSize="xs" color="gray.500" py={2}>
                  No context vectors retrieved yet for this query.
                </Text>
              ) : (
                <VStack align="stretch" gap={3}>
                  {retrievedDocs.map((doc, idx) => (
                    <Box key={idx} bg="gray.50" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.200">
                      <Flex justify="space-between" align="center" mb={1.5}>
                        <Text fontSize="xs" fontWeight="bold" color="black">
                          {doc.title}
                        </Text>
                        <Badge variant="outline" borderColor="black" color="black" fontSize="10px">
                          {doc.score}% similarity
                        </Badge>
                      </Flex>
                      <Text fontSize="xs" color="gray.700" lineHeight="relaxed">
                        {doc.content}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>

            {/* Stage 3 Card */}
            <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} shadow="xs">
              <Flex align="center" justify="space-between" mb={4} pb={3} borderBottom="1px solid" borderColor="gray.100">
                <Flex align="center" gap={2}>
                  <Badge variant="outline" borderColor="black" color="black" fontSize="xs" px={2} py={0.5}>
                    Stage 3
                  </Badge>
                  <Heading size="sm" color="black" fontWeight="bold">
                    LLM Diagnostic Synthesis (Gemini 2.5 Flash)
                  </Heading>
                </Flex>
                <Badge variant="outline" borderColor="black" color="black" fontSize="xs">
                  Gemini LLM
                </Badge>
              </Flex>

              <Stack gap={4}>
                <Box>
                  <Text fontSize="10px" fontWeight="bold" color="gray.500" textTransform="uppercase" mb={1}>
                    Constructed System Prompt Payload
                  </Text>
                  <Box
                    as="pre"
                    bg="black"
                    color="green.400"
                    p={4}
                    borderRadius="lg"
                    fontSize="11px"
                    fontFamily="mono"
                    overflowX="auto"
                    whiteSpace="pre-wrap"
                  >
                    {pipelineMode === "direct"
                      ? `[Context vectors loaded...]\nUser Query (${currentLanguage}): "${originalQuery || '...'}"\nConstraint: Respond natively in ${currentLanguage}.`
                      : `[Context vectors loaded...]\nUser Query (English): "${translatedQuery || '...'}"\nConstraint: Respond concisely in English.`}
                  </Box>
                </Box>

                <Box bg="gray.50" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.200">
                  <Text fontSize="10px" fontWeight="bold" color="gray.500" textTransform="uppercase" mb={1}>
                    Synthesized Extension Output ({pipelineMode === "direct" ? currentLanguage : "English"})
                  </Text>
                  <Text fontSize="xs" color="black" lineHeight="relaxed">
                    {(pipelineMode === "direct" ? finalResponse : englishResponse) || "Awaiting Gemini LLM synthesis..."}
                  </Text>
                </Box>
              </Stack>
            </Box>

            {/* Stage 4 Card */}
            <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} shadow="xs">
              <Flex align="center" justify="space-between" mb={4} pb={3} borderBottom="1px solid" borderColor="gray.100">
                <Flex align="center" gap={2}>
                  <Badge variant="outline" borderColor="black" color="black" fontSize="xs" px={2} py={0.5}>
                    Stage 4
                  </Badge>
                  <Heading size="sm" color="black" fontWeight="bold">
                    Output Translation & Dialect Alignment (NLLB-200)
                  </Heading>
                </Flex>

                {pipelineMode === "direct" ? (
                  <Badge variant="outline" borderColor="gray.400" color="gray.600" fontSize="xs">
                    Bypassed in Direct Dialect Mode
                  </Badge>
                ) : (
                  <Badge variant="outline" borderColor="black" color="black" fontSize="xs">
                    Localized Output
                  </Badge>
                )}
              </Flex>

              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                <Box bg="gray.50" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.200">
                  <Text fontSize="10px" fontWeight="bold" color="gray.500" textTransform="uppercase" mb={1}>
                    English Synthesis Baseline
                  </Text>
                  <Text fontSize="xs" color="black" lineHeight="relaxed">
                    {englishResponse || "Awaiting English response..."}
                  </Text>
                </Box>

                <Box bg="gray.50" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.200">
                  <Text fontSize="10px" fontWeight="bold" color="gray.500" textTransform="uppercase" mb={1}>
                    Final Localized Advisory Response ({currentLanguage})
                  </Text>
                  <Text fontSize="xs" color="black" fontWeight="semibold" lineHeight="relaxed">
                    {finalResponse || "Awaiting localized advisory translation..."}
                  </Text>
                </Box>
              </Grid>
            </Box>

            {/* Execution Terminal Log Box */}
            <Box bg="black" color="green.400" borderRadius="2xl" p={5} shadow="xl" fontFamily="mono">
              <Flex align="center" justify="space-between" mb={3} pb={2} borderBottom="1px solid" borderColor="gray.800">
                <Flex align="center" gap={2}>
                  <Terminal size={16} color="#4ade80" />
                  <Text fontSize="xs" fontWeight="bold" color="green.400">
                    Execution Trace Log Terminal
                  </Text>
                </Flex>
                <Button
                  size="xs"
                  variant="outline"
                  borderColor="gray.700"
                  color="green.400"
                  _hover={{ bg: "gray.900" }}
                  onClick={() =>
                    copyToClipboard(
                      logs.map((l) => `[${l.stage}] ${l.message}`).join("\n"),
                      "execution log"
                    )
                  }
                >
                  <Copy size={12} style={{ marginRight: 4 }} /> Copy Log
                </Button>
              </Flex>

              <Box maxH="240px" overflowY="auto" fontSize="11px" lineHeight="relaxed" pr={2}>
                <Text color="gray.500" mb={2}>
                  $ trace --live --verbose --network={networkProfile}
                </Text>
                {logs.map((log, i) => (
                  <Flex key={i} gap={3} mb={1}>
                    <Text color="gray.400" flexShrink={0}>
                      [{log.stage}]
                    </Text>
                    <Text color="green.300">{log.message}</Text>
                  </Flex>
                ))}
                <Text color="gray.500" mt={3}>
                  --- End of active execution trace ---
                </Text>
              </Box>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
