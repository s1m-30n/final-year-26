import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Grid,
  Heading,
  Text,
  Badge,
  Button,
  IconButton,
  Input,
  Textarea,
  Spinner,
  Separator,
  Stack,
  HStack,
  VStack,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  Database,
  Plus,
  Search,
  Check,
  FileText,
  Tag,
  RefreshCw,
  X,
  Copy,
  Eye,
  LayoutGrid,
  List,
  Sparkles,
  Filter,
  BookOpen,
  AlertCircle,
  Cpu,
  Layers,
} from "lucide-react";

interface VectorDBExplorerProps {
  backendUrl: string;
}

interface DocumentItem {
  id: string;
  content: string;
  metadata: {
    title: string;
    crop: string;
    category: string;
    keywords: string;
  };
}

const CROP_OPTIONS = ["Cassava", "Maize", "Yam", "Tomato", "General", "Cocoa", "Rice", "Oil Palm"];
const CATEGORY_OPTIONS = [
  "Root & Tuber Crops",
  "Cereals & Grains",
  "Pest Control",
  "Soil & Land Management",
  "Post-Harvest Processing",
  "Agro-Forestry",
];

export default function VectorDBExplorer({ backendUrl }: VectorDBExplorerProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCrop, setSelectedCrop] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showAddForm, setShowAddForm] = useState(false);
  const [inspectDoc, setInspectDoc] = useState<DocumentItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newCrop, setNewCrop] = useState("Cassava");
  const [newCategory, setNewCategory] = useState("Root & Tuber Crops");
  const [newContent, setNewContent] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [addStatus, setAddStatus] = useState<"idle" | "adding" | "success" | "failed">("idle");

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchDocuments = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${backendUrl}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      } else {
        setError("Failed to fetch vector documents from ChromaDB.");
      }
    } catch {
      setError("Unable to connect to the AgriRAG backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [backendUrl]);

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;
    setAddStatus("adding");
    try {
      const response = await fetch(`${backendUrl}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          crop: newCrop,
          category: newCategory,
          content: newContent,
          keywords: newKeywords,
        }),
      });

      if (response.ok) {
        setAddStatus("success");
        showNotification(`Successfully indexed: "${newTitle}"`);
        setNewTitle("");
        setNewContent("");
        setNewKeywords("");
        fetchDocuments();
        setTimeout(() => {
          setAddStatus("idle");
          setShowAddForm(false);
        }, 1200);
      } else {
        setAddStatus("failed");
      }
    } catch {
      setAddStatus("failed");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showNotification(`Copied ${label} to clipboard!`);
  };

  // Filtering
  const filteredDocs = documents.filter((doc) => {
    const t = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      doc.metadata?.title?.toLowerCase().includes(t) ||
      doc.content?.toLowerCase().includes(t) ||
      doc.metadata?.crop?.toLowerCase().includes(t) ||
      doc.metadata?.category?.toLowerCase().includes(t) ||
      doc.metadata?.keywords?.toLowerCase().includes(t);

    const matchesCrop = selectedCrop === "All" || doc.metadata?.crop === selectedCrop;
    const matchesCategory = selectedCategory === "All" || doc.metadata?.category === selectedCategory;

    return matchesSearch && matchesCrop && matchesCategory;
  });

  // Calculate stats
  const uniqueCrops = Array.from(new Set(documents.map((d) => d.metadata?.crop).filter(Boolean)));
  const uniqueCategories = Array.from(new Set(documents.map((d) => d.metadata?.category).filter(Boolean)));

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
        {/* Header Section */}
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
                <Database size={22} />
              </Box>
              <Heading size="xl" color="black" fontWeight="extrabold" letterSpacing="tight">
                ChromaDB Vector Explorer
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
                Vector Store Active
              </Badge>
            </Flex>
            <Text color="gray.600" fontSize="sm" mt={1}>
              Inspect, query, and index agricultural advisory vector embeddings in real time.
            </Text>
          </Box>

          <HStack gap={3} flexWrap="wrap">
            <Button
              onClick={fetchDocuments}
              variant="outline"
              borderColor="gray.300"
              color="black"
              bg="white"
              _hover={{ bg: "gray.100", borderColor: "black" }}
              size="sm"
              height="38px"
              px={4}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ marginRight: 6 }} />
              Refresh
            </Button>

            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              bg="black"
              color="white"
              _hover={{ bg: "gray.800" }}
              size="sm"
              height="38px"
              px={4}
              fontWeight="semibold"
            >
              {showAddForm ? (
                <>
                  <X size={16} style={{ marginRight: 6 }} /> Close Form
                </>
              ) : (
                <>
                  <Plus size={16} style={{ marginRight: 6 }} /> Add Document
                </>
              )}
            </Button>
          </HStack>
        </Flex>

        {/* Stats Grid */}
        <SimpleGrid columns={{ base: 2, lg: 4 }} gap={4} mb={8}>
          <Box bg="white" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="xs">
            <Flex align="center" justify="space-between">
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                Total Vectors
              </Text>
              <BookOpen size={16} color="#71717a" />
            </Flex>
            <Text fontSize="2xl" fontWeight="black" color="black" mt={1}>
              {documents.length}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Indexed Extension Snippets
            </Text>
          </Box>

          <Box bg="white" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="xs">
            <Flex align="center" justify="space-between">
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                Crop Focuses
              </Text>
              <Tag size={16} color="#71717a" />
            </Flex>
            <Text fontSize="2xl" fontWeight="black" color="black" mt={1}>
              {uniqueCrops.length}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Distinct Crop Domains
            </Text>
          </Box>

          <Box bg="white" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="xs">
            <Flex align="center" justify="space-between">
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                Categories
              </Text>
              <Layers size={16} color="#71717a" />
            </Flex>
            <Text fontSize="2xl" fontWeight="black" color="black" mt={1}>
              {uniqueCategories.length}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Knowledge Classifications
            </Text>
          </Box>

          <Box bg="white" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="xs">
            <Flex align="center" justify="space-between">
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                Embedding Model
              </Text>
              <Cpu size={16} color="#71717a" />
            </Flex>
            <Text fontSize="2xl" fontWeight="black" color="black" mt={1}>
              384-dim
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              all-MiniLM-L6-v2
            </Text>
          </Box>
        </SimpleGrid>

        {/* Add Document Form Section */}
        {showAddForm && (
          <Box
            bg="white"
            borderWidth="2px"
            borderColor="black"
            borderRadius="2xl"
            p={{ base: 5, md: 6 }}
            mb={8}
            shadow="md"
          >
            <Flex align="center" justify="space-between" mb={4} pb={3} borderBottom="1px solid" borderColor="gray.200">
              <Flex align="center" gap={2}>
                <Sparkles size={18} color="black" />
                <Heading size="md" color="black" fontWeight="bold">
                  Index New Agricultural Advisory Document
                </Heading>
              </Flex>
              <Badge variant="outline" borderColor="black" color="black" px={2} py={0.5} fontSize="xs">
                ChromaDB Embedder
              </Badge>
            </Flex>

            <form onSubmit={handleAddDocument}>
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4} mb={4}>
                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="black" mb={1} textTransform="uppercase">
                    Document Title *
                  </Text>
                  <Input
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Maize Rust Fungicide Treatment"
                    borderColor="gray.300"
                    _focus={{ borderColor: "black" }}
                    fontSize="sm"
                    bg="white"
                    color="black"
                  />
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="black" mb={1} textTransform="uppercase">
                    Crop Focus
                  </Text>
                  <select
                    style={{
                      width: "100%",
                      height: "40px",
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
                    value={newCrop}
                    onChange={(e) => setNewCrop(e.target.value)}
                  >
                    {CROP_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="black" mb={1} textTransform="uppercase">
                    Domain Category
                  </Text>
                  <select
                    style={{
                      width: "100%",
                      height: "40px",
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
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </Box>
              </Grid>

              <Box mb={4}>
                <Flex justify="space-between" align="center" mb={1}>
                  <Text fontSize="xs" fontWeight="bold" color="black" textTransform="uppercase">
                    Advisory Content (Text for Vectorization) *
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {newContent.length} chars / ~{Math.ceil(newContent.split(/\s+/).filter(Boolean).length)} words
                  </Text>
                </Flex>
                <Textarea
                  required
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Enter extension bulletin or diagnostic treatment text to generate embeddings..."
                  borderColor="gray.300"
                  _focus={{ borderColor: "black" }}
                  fontSize="sm"
                  bg="white"
                  color="black"
                />
              </Box>

              <Box mb={6}>
                <Text fontSize="xs" fontWeight="bold" color="black" mb={1} textTransform="uppercase">
                  Keywords & Tags (Comma Separated)
                </Text>
                <Input
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  placeholder="e.g. maize, rust, fungal spray, advisory"
                  borderColor="gray.300"
                  _focus={{ borderColor: "black" }}
                  fontSize="sm"
                  bg="white"
                  color="black"
                />
              </Box>

              <Flex justify="flex-end" gap={3}>
                <Button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  variant="outline"
                  borderColor="gray.300"
                  color="black"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  bg="black"
                  color="white"
                  _hover={{ bg: "gray.800" }}
                  size="sm"
                  px={6}
                  disabled={addStatus === "adding"}
                >
                  {addStatus === "adding" ? (
                    <Flex align="center" gap={2}>
                      <Spinner size="xs" color="white" />
                      Indexing Vector...
                    </Flex>
                  ) : addStatus === "success" ? (
                    <Flex align="center" gap={2}>
                      <Check size={16} /> Indexed Successfully
                    </Flex>
                  ) : (
                    "Index into ChromaDB"
                  )}
                </Button>
              </Flex>
            </form>
          </Box>
        )}

        {/* Filter Controls & Search */}
        <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} mb={6} shadow="xs">
          <Flex direction={{ base: "column", md: "row" }} justify="space-between" align="center" gap={4} mb={4}>
            {/* Search input */}
            <Box position="relative" width={{ base: "100%", md: "420px" }}>
              <Input
                placeholder="Search vectors by title, content, or crop..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                pl={10}
                pr={searchTerm ? 9 : 3}
                borderColor="gray.300"
                _focus={{ borderColor: "black" }}
                fontSize="sm"
                bg="gray.50"
                color="black"
                height="40px"
              />
              <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="gray.400">
                <Search size={16} />
              </Box>
              {searchTerm && (
                <IconButton
                  aria-label="Clear search"
                  size="xs"
                  variant="ghost"
                  position="absolute"
                  right={2}
                  top="50%"
                  transform="translateY(-50%)"
                  onClick={() => setSearchTerm("")}
                  color="gray.500"
                >
                  <X size={14} />
                </IconButton>
              )}
            </Box>

            {/* View Mode Toggle & Results Count */}
            <Flex align="center" gap={3} width={{ base: "100%", md: "auto" }} justify="space-between">
              <Text fontSize="xs" fontWeight="semibold" color="gray.500">
                Showing <Text as="span" color="black" fontWeight="bold">{filteredDocs.length}</Text> of {documents.length} vectors
              </Text>

              <HStack gap={1} bg="gray.100" p={1} borderRadius="lg" border="1px solid" borderColor="gray.200">
                <Button
                  size="xs"
                  variant={viewMode === "grid" ? "solid" : "ghost"}
                  bg={viewMode === "grid" ? "black" : "transparent"}
                  color={viewMode === "grid" ? "white" : "gray.700"}
                  _hover={{ bg: viewMode === "grid" ? "black" : "gray.200" }}
                  onClick={() => setViewMode("grid")}
                  px={2.5}
                  py={1}
                  height="28px"
                >
                  <LayoutGrid size={14} style={{ marginRight: 4 }} /> Grid
                </Button>
                <Button
                  size="xs"
                  variant={viewMode === "list" ? "solid" : "ghost"}
                  bg={viewMode === "list" ? "black" : "transparent"}
                  color={viewMode === "list" ? "white" : "gray.700"}
                  _hover={{ bg: viewMode === "list" ? "black" : "gray.200" }}
                  onClick={() => setViewMode("list")}
                  px={2.5}
                  py={1}
                  height="28px"
                >
                  <List size={14} style={{ marginRight: 4 }} /> List
                </Button>
              </HStack>
            </Flex>
          </Flex>

          <Separator mb={4} borderColor="gray.100" />

          {/* Crop Filter Pills */}
          <Flex align="center" gap={2} flexWrap="wrap">
            <Text fontSize="xs" fontWeight="bold" color="gray.500" mr={1} textTransform="uppercase">
              <Filter size={12} style={{ display: "inline", marginRight: 4 }} /> Crop:
            </Text>
            {["All", ...CROP_OPTIONS].map((crop) => {
              const isActive = selectedCrop === crop;
              return (
                <Button
                  key={crop}
                  size="xs"
                  variant={isActive ? "solid" : "outline"}
                  bg={isActive ? "black" : "white"}
                  color={isActive ? "white" : "black"}
                  borderColor={isActive ? "black" : "gray.300"}
                  _hover={{ bg: isActive ? "gray.800" : "gray.100" }}
                  onClick={() => setSelectedCrop(crop)}
                  borderRadius="full"
                  px={3}
                  height="26px"
                  fontSize="xs"
                  fontWeight={isActive ? "bold" : "normal"}
                >
                  {crop}
                </Button>
              );
            })}
          </Flex>
        </Box>

        {/* Content Area */}
        {loading ? (
          <Box py={16} textAlign="center" bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl">
            <Spinner size="lg" color="black" mb={3} />
            <Text color="black" fontWeight="medium" fontSize="sm">
              Connecting to ChromaDB and loading vector embeddings...
            </Text>
          </Box>
        ) : error ? (
          <Box py={10} px={6} bg="white" borderWidth="1px" borderColor="black" borderRadius="xl" textAlign="center">
            <AlertCircle size={32} color="black" style={{ margin: "0 auto 12px" }} />
            <Heading size="md" color="black" mb={1}>
              Vector Database Connection Issue
            </Heading>
            <Text color="gray.600" fontSize="sm" maxW="lg" mx="auto" mb={4}>
              {error}
            </Text>
            <Button size="sm" bg="black" color="white" onClick={fetchDocuments}>
              Retry Connection
            </Button>
          </Box>
        ) : filteredDocs.length === 0 ? (
          <Box py={16} textAlign="center" bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl">
            <Database size={40} color="#a1a1aa" style={{ margin: "0 auto 12px" }} />
            <Heading size="sm" color="black" mb={1}>
              No matching vector documents found
            </Heading>
            <Text color="gray.500" fontSize="xs" mb={4}>
              Try adjusting your search keywords or crop filter settings.
            </Text>
            {(searchTerm || selectedCrop !== "All" || selectedCategory !== "All") && (
              <Button
                size="xs"
                variant="outline"
                borderColor="black"
                color="black"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCrop("All");
                  setSelectedCategory("All");
                }}
              >
                Reset All Filters
              </Button>
            )}
          </Box>
        ) : viewMode === "grid" ? (
          /* Grid View */
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5}>
            {filteredDocs.map((doc) => (
              <Box
                key={doc.id}
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="xl"
                p={5}
                shadow="xs"
                display="flex"
                flexDirection="column"
                justifyContent="space-between"
                transition="all 0.15s ease-in-out"
                _hover={{ borderColor: "black", shadow: "md" }}
              >
                <Box>
                  <Flex align="center" justify="space-between" mb={2.5}>
                    <Badge variant="outline" borderColor="gray.300" color="gray.700" fontSize="10px" px={2} py={0.5}>
                      #{doc.id}
                    </Badge>
                    <Badge variant="outline" borderColor="black" color="black" fontSize="10px" fontWeight="bold" px={2} py={0.5}>
                      {doc.metadata?.crop || "General"}
                    </Badge>
                  </Flex>

                  <Heading size="sm" color="black" fontWeight="bold" mb={2} lineHeight="snug">
                    {doc.metadata?.title || "Untitled Advisory"}
                  </Heading>

                  <Badge colorPalette="gray" variant="subtle" fontSize="xs" mb={3}>
                    <FileText size={10} style={{ display: "inline", marginRight: 4 }} />
                    {doc.metadata?.category || "Extension Advisory"}
                  </Badge>

                  <Text
                    fontSize="xs"
                    color="gray.700"
                    lineHeight="relaxed"
                    mb={4}
                    css={{
                      display: "-webkit-box",
                      WebkitLineClamp: "4",
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {doc.content}
                  </Text>
                </Box>

                <Box borderTop="1px solid" borderColor="gray.100" pt={3} mt={2}>
                  {doc.metadata?.keywords && (
                    <Flex wrap="wrap" gap={1} mb={3}>
                      {doc.metadata.keywords
                        .split(",")
                        .slice(0, 3)
                        .map((kw, i) => (
                          <Text
                            key={i}
                            fontSize="10px"
                            bg="gray.100"
                            color="gray.700"
                            px={2}
                            py={0.5}
                            borderRadius="sm"
                            fontWeight="medium"
                          >
                            #{kw.trim()}
                          </Text>
                        ))}
                    </Flex>
                  )}

                  <Flex align="center" justify="space-between">
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="gray.300"
                      color="black"
                      _hover={{ bg: "gray.100" }}
                      onClick={() => setInspectDoc(doc)}
                      height="26px"
                      fontSize="xs"
                    >
                      <Eye size={12} style={{ marginRight: 4 }} /> Inspect
                    </Button>

                    <Button
                      size="xs"
                      variant="ghost"
                      color="gray.700"
                      _hover={{ bg: "gray.100", color: "black" }}
                      onClick={() => copyToClipboard(doc.content, "advisory text")}
                      height="26px"
                      fontSize="xs"
                    >
                      <Copy size={12} style={{ marginRight: 4 }} /> Copy
                    </Button>
                  </Flex>
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        ) : (
          /* List View */
          <VStack align="stretch" gap={3}>
            {filteredDocs.map((doc) => (
              <Box
                key={doc.id}
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="lg"
                p={4}
                shadow="xs"
                transition="all 0.15s ease-in-out"
                _hover={{ borderColor: "black" }}
              >
                <Flex direction={{ base: "column", sm: "row" }} justify="space-between" align={{ base: "flex-start", sm: "center" }} gap={3} mb={2}>
                  <HStack gap={2} flexWrap="wrap">
                    <Badge variant="outline" borderColor="gray.300" color="gray.600" fontSize="10px">
                      #{doc.id}
                    </Badge>
                    <Heading size="xs" color="black" fontWeight="bold">
                      {doc.metadata?.title}
                    </Heading>
                  </HStack>

                  <HStack gap={2}>
                    <Badge variant="outline" borderColor="black" color="black" fontSize="10px">
                      {doc.metadata?.crop}
                    </Badge>
                    <Badge variant="outline" borderColor="gray.300" color="gray.700" fontSize="10px">
                      {doc.metadata?.category}
                    </Badge>
                  </HStack>
                </Flex>

                <Text fontSize="xs" color="gray.700" mb={3} lineClamp={2}>
                  {doc.content}
                </Text>

                <Flex justify="space-between" align="center" borderTop="1px solid" borderColor="gray.100" pt={2}>
                  <Text fontSize="10px" color="gray.500">
                    Keywords: {doc.metadata?.keywords || "None"}
                  </Text>
                  <HStack gap={2}>
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="gray.300"
                      color="black"
                      onClick={() => setInspectDoc(doc)}
                      height="24px"
                    >
                      <Eye size={12} style={{ marginRight: 4 }} /> Inspect
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      color="gray.700"
                      onClick={() => copyToClipboard(doc.content, "text")}
                      height="24px"
                    >
                      <Copy size={12} style={{ marginRight: 4 }} /> Copy
                    </Button>
                  </HStack>
                </Flex>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      {/* Vector Metadata Inspection Modal */}
      {inspectDoc && (
        <Box
          position="fixed"
          inset={0}
          zIndex={999}
          bg="rgba(0, 0, 0, 0.6)"
          backdropFilter="blur(4px)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={4}
        >
          <Box
            bg="white"
            borderWidth="2px"
            borderColor="black"
            borderRadius="2xl"
            maxW="700px"
            width="100%"
            maxH="85vh"
            overflowY="auto"
            p={{ base: 5, md: 6 }}
            boxShadow="2xl"
          >
            <Flex justify="space-between" align="center" mb={4} pb={3} borderBottom="1px solid" borderColor="gray.200">
              <Box>
                <Badge variant="outline" borderColor="black" color="black" fontSize="xs" mb={1}>
                  #{inspectDoc.id}
                </Badge>
                <Heading size="md" color="black" fontWeight="bold">
                  {inspectDoc.metadata?.title}
                </Heading>
              </Box>
              <IconButton
                aria-label="Close modal"
                size="sm"
                variant="ghost"
                color="black"
                onClick={() => setInspectDoc(null)}
              >
                <X size={18} />
              </IconButton>
            </Flex>

            <Stack gap={4} mb={6}>
              <Flex gap={3} flexWrap="wrap">
                <Box bg="gray.50" p={3} borderRadius="lg" borderWidth="1px" borderColor="gray.200" flex="1" minW="140px">
                  <Text fontSize="10px" color="gray.500" fontWeight="bold" textTransform="uppercase">
                    Crop Focus
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color="black">
                    {inspectDoc.metadata?.crop || "N/A"}
                  </Text>
                </Box>

                <Box bg="gray.50" p={3} borderRadius="lg" borderWidth="1px" borderColor="gray.200" flex="1" minW="140px">
                  <Text fontSize="10px" color="gray.500" fontWeight="bold" textTransform="uppercase">
                    Category
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color="black">
                    {inspectDoc.metadata?.category || "N/A"}
                  </Text>
                </Box>

                <Box bg="gray.50" p={3} borderRadius="lg" borderWidth="1px" borderColor="gray.200" flex="1" minW="140px">
                  <Text fontSize="10px" color="gray.500" fontWeight="bold" textTransform="uppercase">
                    Est. Tokens
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color="black">
                    ~{Math.ceil((inspectDoc.content?.length || 0) / 4)}
                  </Text>
                </Box>
              </Flex>

              <Box>
                <Text fontSize="xs" fontWeight="bold" color="black" textTransform="uppercase" mb={1.5}>
                  Full Advisory Content
                </Text>
                <Box
                  bg="gray.50"
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="lg"
                  p={4}
                  fontSize="xs"
                  color="black"
                  lineHeight="relaxed"
                  whiteSpace="pre-wrap"
                >
                  {inspectDoc.content}
                </Box>
              </Box>

              <Box>
                <Text fontSize="xs" fontWeight="bold" color="black" textTransform="uppercase" mb={1.5}>
                  ChromaDB Metadata Object
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
                >
                  {JSON.stringify(inspectDoc.metadata, null, 2)}
                </Box>
              </Box>
            </Stack>

            <Flex justify="flex-end" gap={3} pt={3} borderTop="1px solid" borderColor="gray.200">
              <Button
                size="sm"
                variant="outline"
                borderColor="gray.300"
                color="black"
                onClick={() => copyToClipboard(JSON.stringify(inspectDoc, null, 2), "document JSON")}
              >
                <Copy size={14} style={{ marginRight: 6 }} /> Copy JSON
              </Button>
              <Button size="sm" bg="black" color="white" onClick={() => setInspectDoc(null)}>
                Close
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
  );
}
