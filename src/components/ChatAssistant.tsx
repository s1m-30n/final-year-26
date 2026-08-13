import React, { useState, useRef } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Badge,
  Button,
  IconButton,
  Input,
  Spinner,
  VStack,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  Send,
  Mic,
  Camera,
  Leaf,
  Sprout,
  Sparkles,
  Bot,
  User,
  Check,
  ChevronDown,
  ChevronUp,
  Volume2,
  Trash2,
  FileText,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  originalText?: string;
  sourceLang?: string;
  timestamp: string;
  context?: {
    title: string;
    score: number;
    crop?: string;
    category?: string;
    publisher?: string;
  }[];
  isDiagnostic?: boolean;
  diagnosticData?: {
    disease: string;
    crop: string;
    confidence: number;
    symptoms: string[];
    treatment: string[];
  };
}

interface ChatAssistantProps {
  backendUrl: string;
  geminiKey: string;
  hfToken: string;
  onNewLog: (stage: string, message: string) => void;
  onClearLogs: () => void;
  onSetPipelineData: (data: {
    originalQuery: string;
    translatedQuery: string;
    englishResponse: string;
    finalResponse: string;
    retrievedDocs: { title: string; score: number; content: string }[];
  }) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  pipelineMode: "pivot" | "direct";
  setPipelineMode: (mode: "pivot" | "direct") => void;
}

export default function ChatAssistant({
  backendUrl,
  geminiKey,
  hfToken,
  onNewLog,
  onClearLogs,
  onSetPipelineData,
  selectedLanguage,
  setSelectedLanguage,
  pipelineMode,
  setPipelineMode,
}: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "agent",
      text: "Welcome to the Agricultural RAG Extension Service. You can ask questions in English, Nigerian Pidgin, Hausa, Igbo or Yoruba. Send text, record voice, or upload a crop leaf image for diagnosis.",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showVoiceSamples, setShowVoiceSamples] = useState(false);
  const [expandedContextId, setExpandedContextId] = useState<string | null>(null);
  const [is2GMode, setIs2GMode] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sampleLeaves = [
    { name: "Cassava (CMD)", icon: Leaf, disease: "Cassava Mosaic Disease", crop: "Cassava" },
    { name: "Mango (Anthracnose)", icon: Sparkles, disease: "Mango Anthracnose", crop: "Mango" },
    { name: "Plantain (Sigatoka)", icon: Leaf, disease: "Black Sigatoka", crop: "Plantain" },
    { name: "Citrus (Canker)", icon: Sparkles, disease: "Citrus Canker", crop: "Citrus" },
    { name: "Maize (FAW)", icon: Sprout, disease: "Fall Armyworm Damage", crop: "Maize" },
    { name: "Tomato (Blight)", icon: Sparkles, disease: "Tomato Early Blight", crop: "Tomato" },
  ];

  const voiceSamples = [
    {
      text: "How i fit cure cassava mosaic disease?",
      lang: "Nigerian Pidgin",
      transcript: "How i fit cure cassava mosaic disease? My leaves dey turn yellow.",
    },
    {
      text: "Yaya zan warkar da cutar mosaic rogo?",
      lang: "Hausa",
      transcript: "Yaya zan warkar da cutar mosaic rogo? Ganyen rogo na suna ta lalacewa.",
    },
    {
      text: "Olee otu m ga-esi agwọ ọrịa cassava mosaic?",
      lang: "Igbo",
      transcript: "Olee otu m ga-esi agwọ ọrịa cassava mosaic? Akwụkwọ ji m na-acha edo edo.",
    },
    {
      text: "Bawo ni mo ṣe le tọju aarun cassava mosaic?",
      lang: "Yoruba",
      transcript: "Bawo ni mo ṣe le tọju aarun cassava mosaic? Awọn ewe mi n yipada si yẹlo.",
    },
  ];

  const handleSendMessage = async (textToSend: string, lang = selectedLanguage) => {
    if (!textToSend.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: textToSend,
      sourceLang: lang,
      timestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    onClearLogs();
    setTimeout(scrollToBottom, 100);
    onNewLog("Pipeline Start", `Query received in ${lang}: "${textToSend}"`);

    const cacheKey = `rag_2g_cache_${lang}_${textToSend.trim().toLowerCase()}`;
    const cachedResponse = localStorage.getItem(cacheKey);
    if (cachedResponse && is2GMode) {
      try {
        const cachedData = JSON.parse(cachedResponse);
        onNewLog("2G Cache Hit", `Instant response retrieved from local 2G offline cache (0ms network latency).`);
        onSetPipelineData({
          originalQuery: cachedData.original_query || textToSend,
          translatedQuery: cachedData.translated_query || "[Cached]",
          englishResponse: cachedData.english_response || "",
          finalResponse: cachedData.final_response || "",
          retrievedDocs: cachedData.context || [],
        });
        if (cachedData.pipeline_logs) {
          cachedData.pipeline_logs.forEach((log: { stage: string; message: string }) => onNewLog(log.stage, log.message));
        }
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: "agent",
            text: cachedData.final_response,
            originalText: cachedData.english_response,
            sourceLang: lang,
            context: cachedData.context,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
        return;
      } catch {}
    }

    try {
      const response = await fetch(`${backendUrl}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: textToSend,
          language: lang,
          gemini_key: geminiKey,
          hf_token: hfToken,
          pipeline_mode: pipelineMode,
        }),
      });
      if (!response.ok) throw new Error(`Server returned code ${response.status}`);
      const data = await response.json();

      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {}

      onSetPipelineData({
        originalQuery: data.original_query,
        translatedQuery: data.translated_query,
        englishResponse: data.english_response,
        finalResponse: data.final_response,
        retrievedDocs: data.context,
      });
      if (data.pipeline_logs) {
        data.pipeline_logs.forEach((log: { stage: string; message: string }) => onNewLog(log.stage, log.message));
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "agent",
          text: data.final_response,
          originalText: data.english_response,
          sourceLang: lang,
          context: data.context,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      onNewLog("Pipeline Error", `Failed: ${err.message}`);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "agent",
          text: `Error: ${err.message}. Check your API key and backend server.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setTimeout(scrollToBottom, 100);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceRecord = async () => {
    if (recording) {
      setRecording(false);
      onNewLog("Speech Recording", "Stopping recorder...");
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
          audioBitsPerSecond: 16000,
        });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          stream.getTracks().forEach((track) => track.stop());
          onNewLog("Speech Recording", `Audio captured (${Math.round(audioBlob.size / 1024)} KB)`);

          const formData = new FormData();
          formData.append("audio", audioBlob, "voice_input.webm");
          setLoading(true);

          try {
            const res = await fetch(`${backendUrl}/transcribe`, { method: "POST", body: formData });
            if (res.ok) {
              const data = await res.json();
              if (data.text?.trim()) {
                handleSendMessage(data.text);
              } else {
                showNotification("Could not transcribe speech clearly.");
              }
            } else {
              showNotification("Whisper speech transcription unavailable.");
            }
          } catch {
            showNotification("Audio transcription network error.");
          } finally {
            setLoading(false);
          }
        };
        mediaRecorder.start();
        setRecording(true);
        onNewLog("Speech Recording", "Recording field voice input...");
      } catch {
        showNotification("Microphone access denied or not available.");
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    performImageDiagnosis(file);
  };

  const performImageDiagnosis = async (file: File) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: `[Leaf Diagnosis Request]: Analyzing ${file.name}...`,
      timestamp,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const formData = new FormData();
    formData.append("image", file);
    if (geminiKey) formData.append("gemini_key", geminiKey);
    if (hfToken) formData.append("hf_token", hfToken);

    try {
      const res = await fetch(`${backendUrl}/diagnose`, { method: "POST", body: formData });
      if (res.ok) {
        const diagData = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: "agent",
            text: `Diagnostic Result for ${diagData.crop}: ${diagData.disease}`,
            isDiagnostic: true,
            diagnosticData: diagData,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        showNotification("Leaf diagnosis failed. Ensure Gemini API key is configured.");
      }
    } catch {
      showNotification("Image diagnostic request error.");
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

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

      <Box maxW="1100px" mx="auto">
        {/* Chat Control Navbar / Header */}
        <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" p={{ base: 4, md: 5 }} mb={6} shadow="xs">
          <Flex direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "flex-start", md: "center" }} gap={4}>
            <Box>
              <Flex align="center" gap={3} mb={1}>
                <Box bg="black" color="white" p={2} borderRadius="lg">
                  <Bot size={22} />
                </Box>
                <Heading size="lg" color="black" fontWeight="extrabold" letterSpacing="tight">
                  Multimodal Agricultural Extension Agent
                </Heading>
              </Flex>
              <Text fontSize="xs" color="gray.600">
                AI diagnostic assistant supporting English, Pidgin, Hausa, Igbo & Yoruba extension manuals.
              </Text>
            </Box>

            <Flex gap={2.5} align="center" wrap="wrap">
              {/* Pipeline Mode Badge */}
              <Button
                size="xs"
                variant="outline"
                borderColor={pipelineMode === "direct" ? "black" : "gray.300"}
                bg={pipelineMode === "direct" ? "black" : "white"}
                color={pipelineMode === "direct" ? "white" : "black"}
                onClick={() => setPipelineMode(pipelineMode === "direct" ? "pivot" : "direct")}
                height="32px"
                px={3}
              >
                {pipelineMode === "direct" ? "Direct Native RAG" : "Pivot Mode RAG"}
              </Button>

              {/* 2G Offline Cache Toggle */}
              <Button
                size="xs"
                variant="outline"
                borderColor="black"
                bg={is2GMode ? "black" : "white"}
                color={is2GMode ? "white" : "black"}
                onClick={() => setIs2GMode(!is2GMode)}
                height="32px"
                px={3}
              >
                {is2GMode ? "2G Cache ON" : "2G Cache OFF"}
              </Button>

              {/* Language Selector */}
              <select
                style={{
                  height: "32px",
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
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                <option value="Nigerian Pidgin">Nigerian Pidgin</option>
                <option value="English">English</option>
                <option value="Hausa">Hausa</option>
                <option value="Igbo">Igbo</option>
                <option value="Yoruba">Yoruba</option>
              </select>

              <IconButton
                aria-label="Clear chat messages"
                size="xs"
                variant="outline"
                borderColor="gray.300"
                color="black"
                onClick={() =>
                  setMessages([
                    {
                      id: "welcome",
                      sender: "agent",
                      text: "Welcome to the Agricultural RAG Extension Service. Send text, record voice, or upload a leaf image for diagnosis.",
                      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    },
                  ])
                }
                height="32px"
                width="32px"
              >
                <Trash2 size={14} />
              </IconButton>
            </Flex>
          </Flex>
        </Box>

        {/* Chat Stream Window */}
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="2xl"
          p={{ base: 4, md: 6 }}
          minH="480px"
          maxH="620px"
          overflowY="auto"
          shadow="xs"
          mb={4}
        >
          <VStack align="stretch" gap={5}>
            {messages.map((msg) => (
              <Flex key={msg.id} justify={msg.sender === "user" ? "flex-end" : "flex-start"}>
                <Flex gap={3} maxW={{ base: "90%", md: "80%" }} direction={msg.sender === "user" ? "row-reverse" : "row"}>
                  <Box
                    bg={msg.sender === "user" ? "black" : "gray.100"}
                    color={msg.sender === "user" ? "white" : "black"}
                    p={2}
                    borderRadius="full"
                    width="32px"
                    height="32px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    {msg.sender === "user" ? <User size={16} /> : <Bot size={16} />}
                  </Box>

                  <Box>
                    <Box
                      bg={msg.sender === "user" ? "black" : "white"}
                      color={msg.sender === "user" ? "white" : "black"}
                      borderWidth={msg.sender === "user" ? "0px" : "1px"}
                      borderColor="gray.200"
                      borderRadius="2xl"
                      px={5}
                      py={3.5}
                      shadow={msg.sender === "user" ? "none" : "xs"}
                    >
                      <Text fontSize="xs" fontWeight="semibold" mb={1} color={msg.sender === "user" ? "gray.300" : "gray.500"}>
                        {msg.sender === "user" ? `Farmer (${msg.sourceLang || selectedLanguage})` : "AgriRAG Extension Agent"}
                      </Text>

                      <Text fontSize="sm" lineHeight="relaxed" whiteSpace="pre-wrap">
                        {msg.text}
                      </Text>

                      {/* Diagnostic Result Card */}
                      {msg.isDiagnostic && msg.diagnosticData && (
                        <Box mt={3} pt={3} borderTop="1px solid" borderColor="gray.200">
                          <Badge variant="outline" borderColor="black" color="black" fontSize="xs" mb={2}>
                            Crop: {msg.diagnosticData.crop} ({msg.diagnosticData.confidence}% confidence)
                          </Badge>

                          <Box mb={2}>
                            <Text fontSize="xs" fontWeight="bold" color="black" textTransform="uppercase">
                              Visible Symptoms:
                            </Text>
                            <VStack align="stretch" gap={0.5} mt={1}>
                              {msg.diagnosticData.symptoms.map((s, idx) => (
                                <Text key={idx} fontSize="xs" color="gray.700">
                                  • {s}
                                </Text>
                              ))}
                            </VStack>
                          </Box>

                          <Box>
                            <Text fontSize="xs" fontWeight="bold" color="black" textTransform="uppercase">
                              Actionable Treatment Steps:
                            </Text>
                            <VStack align="stretch" gap={0.5} mt={1}>
                              {msg.diagnosticData.treatment.map((t, idx) => (
                                <Text key={idx} fontSize="xs" color="black" fontWeight="medium">
                                  {idx + 1}. {t}
                                </Text>
                              ))}
                            </VStack>
                          </Box>
                        </Box>
                      )}

                      {/* Context Citation References */}
                      {msg.context && msg.context.length > 0 && (
                        <Box mt={3} pt={3} borderTop="1px solid" borderColor="gray.100">
                          <Button
                            size="xs"
                            variant="ghost"
                            color="gray.600"
                            onClick={() => setExpandedContextId(expandedContextId === msg.id ? null : msg.id)}
                            p={0}
                            height="auto"
                            fontSize="xs"
                            fontWeight="semibold"
                          >
                            <FileText size={12} style={{ marginRight: 4 }} />
                            {msg.context.length} Verified Context Sources Cited
                            {expandedContextId === msg.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </Button>

                          {expandedContextId === msg.id && (
                            <VStack align="stretch" gap={2} mt={2}>
                              {msg.context.map((ctx, idx) => (
                                <Box key={idx} bg="gray.50" p={2.5} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                                  <Flex justify="space-between" align="center">
                                    <Text fontSize="xs" fontWeight="bold" color="black">
                                      {ctx.title}
                                    </Text>
                                    <Badge variant="outline" borderColor="black" color="black" fontSize="10px">
                                      {ctx.score}% match
                                    </Badge>
                                  </Flex>
                                </Box>
                              ))}
                            </VStack>
                          )}
                        </Box>
                      )}
                    </Box>

                    <Text fontSize="10px" color="gray.400" mt={1} px={1} textAlign={msg.sender === "user" ? "right" : "left"}>
                      {msg.timestamp}
                    </Text>
                  </Box>
                </Flex>
              </Flex>
            ))}

            {loading && (
              <Flex justify="flex-start" align="center" gap={3}>
                <Box bg="black" color="white" p={2} borderRadius="full" width="32px" height="32px" display="flex" alignItems="center" justifyContent="center">
                  <Bot size={16} />
                </Box>
                <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" px={4} py={3}>
                  <Flex align="center" gap={2}>
                    <Spinner size="xs" color="black" />
                    <Text fontSize="xs" color="gray.600" fontWeight="medium">
                      Synthesizing advisory context in {selectedLanguage}...
                    </Text>
                  </Flex>
                </Box>
              </Flex>
            )}

            <div ref={messagesEndRef} />
          </VStack>
        </Box>

        {/* Quick Shortcut Pills / Voice & Sample Drawer */}
        <Box mb={4}>
          <Flex align="center" justify="space-between" mb={2}>
            <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
              Quick Diagnostic & Audio Prompts
            </Text>
            <Button
              size="xs"
              variant="ghost"
              color="black"
              onClick={() => setShowVoiceSamples(!showVoiceSamples)}
              fontSize="xs"
            >
              <Volume2 size={12} style={{ marginRight: 4 }} />
              {showVoiceSamples ? "Hide Dialect Audios" : "Voice Query Samples"}
            </Button>
          </Flex>

          <Flex gap={2} flexWrap="wrap" mb={showVoiceSamples ? 3 : 0}>
            {sampleLeaves.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Button
                  key={idx}
                  size="xs"
                  variant="outline"
                  borderColor="gray.300"
                  color="black"
                  _hover={{ bg: "black", color: "white", borderColor: "black" }}
                  onClick={() => handleSendMessage(`What is the treatment for ${item.disease} on ${item.crop}?`)}
                  borderRadius="full"
                  height="28px"
                  fontSize="xs"
                >
                  <Icon size={12} style={{ marginRight: 4 }} /> {item.name}
                </Button>
              );
            })}
          </Flex>

          {showVoiceSamples && (
            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={2} bg="white" p={3} borderRadius="xl" borderWidth="1px" borderColor="gray.200">
              {voiceSamples.map((v, i) => (
                <Box
                  key={i}
                  p={2.5}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="gray.200"
                  bg="gray.50"
                  cursor="pointer"
                  _hover={{ borderColor: "black", bg: "white" }}
                  onClick={() => {
                    setSelectedLanguage(v.lang);
                    handleSendMessage(v.transcript, v.lang);
                  }}
                >
                  <Flex justify="space-between" align="center" mb={1}>
                    <Badge variant="outline" borderColor="black" color="black" fontSize="10px">
                      {v.lang}
                    </Badge>
                    <Volume2 size={12} color="#000000" />
                  </Flex>
                  <Text fontSize="xs" color="black" fontWeight="medium">
                    "{v.text}"
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          )}
        </Box>

        {/* Input Bar Toolbar */}
        <Box bg="white" borderWidth="2px" borderColor="black" borderRadius="2xl" p={3} shadow="md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
          >
            <Flex align="center" gap={2}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: "none" }}
              />

              <IconButton
                aria-label="Upload leaf image"
                size="sm"
                variant="ghost"
                color="black"
                _hover={{ bg: "gray.100" }}
                onClick={() => fileInputRef.current?.click()}
                title="Upload Leaf Image"
              >
                <Camera size={18} />
              </IconButton>

              <IconButton
                aria-label="Record voice prompt"
                size="sm"
                variant="ghost"
                color={recording ? "red.600" : "black"}
                _hover={{ bg: "gray.100" }}
                onClick={handleVoiceRecord}
                title="Record Speech"
                className={recording ? "animate-pulse" : ""}
              >
                <Mic size={18} />
              </IconButton>

              <Input
                placeholder={`Ask an advisory question in ${selectedLanguage}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                borderColor="transparent"
                _focus={{ borderColor: "transparent", outline: "none" }}
                fontSize="sm"
                color="black"
                bg="transparent"
                flex="1"
              />

              <Button
                type="submit"
                bg="black"
                color="white"
                _hover={{ bg: "gray.800" }}
                size="sm"
                px={5}
                height="36px"
                disabled={loading || !inputText.trim()}
              >
                <Send size={14} style={{ marginRight: 6 }} /> Send
              </Button>
            </Flex>
          </form>
        </Box>
      </Box>
    </Box>
  );
}
