import { useState, useEffect } from "react";
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
  Separator,
  Stack,
  HStack,
  VStack,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  Globe,
  ExternalLink,
  Search,
  Building2,
  BookOpen,
  X,
  MapPin,
  Tag,
  Filter,
  Copy,
  Eye,
  Check,
  AlertCircle,
  Award,
} from "lucide-react";

interface IntlOrg {
  id: string;
  acronym: string;
  name: string;
  headquarters: string;
  regional_office?: string;
  website_url: string;
  repository_url: string;
  key_crop_domains: string[];
  description: string;
}

interface Props {
  backendUrl: string;
}

export default function InternationalOrgsExplorer({ backendUrl }: Props) {
  const [organizations, setOrganizations] = useState<IntlOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [inspectOrg, setInspectOrg] = useState<IntlOrg | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchOrganizations = () => {
    setLoading(true);
    setError("");
    fetch(`${backendUrl}/international-organizations`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load international organizations dataset.");
        return res.json();
      })
      .then((data) => {
        setOrganizations(data.organizations || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Unable to connect to AgriRAG backend server.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOrganizations();
  }, [backendUrl]);

  const allDomains = Array.from(
    new Set(organizations.flatMap((org) => org.key_crop_domains || []))
  ).sort();

  const filteredOrgs = organizations.filter((org) => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      org.name?.toLowerCase().includes(s) ||
      org.acronym?.toLowerCase().includes(s) ||
      org.description?.toLowerCase().includes(s) ||
      org.headquarters?.toLowerCase().includes(s);

    const matchDomain =
      selectedDomain === "All" || org.key_crop_domains?.includes(selectedDomain);

    return matchSearch && matchDomain;
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showNotification(`Copied ${label} to clipboard!`);
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
                <Globe size={22} />
              </Box>
              <Heading size="xl" color="black" fontWeight="extrabold" letterSpacing="tight">
                Global Agriculture Partners & Extension Registries
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
                CGIAR & UN Registry
              </Badge>
            </Flex>
            <Text color="gray.600" fontSize="sm" mt={1}>
              Explore CGIAR centers, UN agencies, and global research bodies indexed into the AgriRAG vector engine.
            </Text>
          </Box>

          <HStack gap={3} flexWrap="wrap">
            <Button
              onClick={fetchOrganizations}
              variant="outline"
              borderColor="gray.300"
              color="black"
              bg="white"
              _hover={{ bg: "gray.100", borderColor: "black" }}
              size="sm"
              height="38px"
              px={4}
            >
              Refresh Registry
            </Button>
          </HStack>
        </Flex>

        {/* Stats Grid */}
        <SimpleGrid columns={{ base: 2, lg: 4 }} gap={4} mb={8}>
          <Box bg="white" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="xs">
            <Flex align="center" justify="space-between">
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                Total Partners
              </Text>
              <Building2 size={16} color="#71717a" />
            </Flex>
            <Text fontSize="2xl" fontWeight="black" color="black" mt={1}>
              {organizations.length}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Global Institutions Indexed
            </Text>
          </Box>

          <Box bg="white" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="xs">
            <Flex align="center" justify="space-between">
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                Research Domains
              </Text>
              <Tag size={16} color="#71717a" />
            </Flex>
            <Text fontSize="2xl" fontWeight="black" color="black" mt={1}>
              {allDomains.length}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Crop & Extension Focus Areas
            </Text>
          </Box>

          <Box bg="white" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="xs">
            <Flex align="center" justify="space-between">
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                Primary Network
              </Text>
              <Award size={16} color="#71717a" />
            </Flex>
            <Text fontSize="2xl" fontWeight="black" color="black" mt={1}>
              CGIAR / UN
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Verified Extension Sources
            </Text>
          </Box>

          <Box bg="white" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="xs">
            <Flex align="center" justify="space-between">
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                Repositories
              </Text>
              <BookOpen size={16} color="#71717a" />
            </Flex>
            <Text fontSize="2xl" fontWeight="black" color="black" mt={1}>
              Open Access
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Public Document Manuals
            </Text>
          </Box>
        </SimpleGrid>

        {/* Filter Controls & Search */}
        <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} mb={6} shadow="xs">
          <Flex direction={{ base: "column", md: "row" }} justify="space-between" align="center" gap={4} mb={4}>
            {/* Search Input */}
            <Box position="relative" width={{ base: "100%", md: "450px" }}>
              <Input
                placeholder="Search organizations by name, acronym, or headquarters..."
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

            <Text fontSize="xs" fontWeight="semibold" color="gray.500">
              Showing <Text as="span" color="black" fontWeight="bold">{filteredOrgs.length}</Text> of {organizations.length} partner bodies
            </Text>
          </Flex>

          <Separator mb={4} borderColor="gray.100" />

          {/* Domain Filter Pills */}
          <Flex align="center" gap={2} flexWrap="wrap">
            <Text fontSize="xs" fontWeight="bold" color="gray.500" mr={1} textTransform="uppercase">
              <Filter size={12} style={{ display: "inline", marginRight: 4 }} /> Domain:
            </Text>
            {["All", ...allDomains].map((domain) => {
              const isActive = selectedDomain === domain;
              return (
                <Button
                  key={domain}
                  size="xs"
                  variant={isActive ? "solid" : "outline"}
                  bg={isActive ? "black" : "white"}
                  color={isActive ? "white" : "black"}
                  borderColor={isActive ? "black" : "gray.300"}
                  _hover={{ bg: isActive ? "gray.800" : "gray.100" }}
                  onClick={() => setSelectedDomain(domain)}
                  borderRadius="full"
                  px={3}
                  height="26px"
                  fontSize="xs"
                  fontWeight={isActive ? "bold" : "normal"}
                >
                  {domain}
                </Button>
              );
            })}
          </Flex>
        </Box>

        {/* Content Section */}
        {loading ? (
          <Box py={16} textAlign="center" bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl">
            <Spinner size="lg" color="black" mb={3} />
            <Text color="black" fontWeight="medium" fontSize="sm">
              Fetching international agriculture partner directory...
            </Text>
          </Box>
        ) : error ? (
          <Box py={10} px={6} bg="white" borderWidth="1px" borderColor="black" borderRadius="xl" textAlign="center">
            <AlertCircle size={32} color="black" style={{ margin: "0 auto 12px" }} />
            <Heading size="md" color="black" mb={1}>
              Partner Registry Connection Error
            </Heading>
            <Text color="gray.600" fontSize="sm" maxW="lg" mx="auto" mb={4}>
              {error}
            </Text>
            <Button size="sm" bg="black" color="white" onClick={fetchOrganizations}>
              Retry Loading
            </Button>
          </Box>
        ) : filteredOrgs.length === 0 ? (
          <Box py={16} textAlign="center" bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl">
            <Globe size={40} color="#a1a1aa" style={{ margin: "0 auto 12px" }} />
            <Heading size="sm" color="black" mb={1}>
              No matching agricultural institutions found
            </Heading>
            <Text color="gray.500" fontSize="xs" mb={4}>
              Try clearing your search query or selecting "All" research domains.
            </Text>
            {(searchTerm || selectedDomain !== "All") && (
              <Button
                size="xs"
                variant="outline"
                borderColor="black"
                color="black"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDomain("All");
                }}
              >
                Reset Filters
              </Button>
            )}
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5}>
            {filteredOrgs.map((org) => (
              <Box
                key={org.id}
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
                  <Flex align="flex-start" justify="space-between" mb={3}>
                    <Badge variant="outline" borderColor="black" color="black" fontSize="11px" fontWeight="black" px={2.5} py={0.5}>
                      {org.acronym}
                    </Badge>
                    <Box bg="gray.100" p={1.5} borderRadius="md" color="black">
                      <Building2 size={16} />
                    </Box>
                  </Flex>

                  <Heading size="sm" color="black" fontWeight="bold" mb={2} lineHeight="snug">
                    {org.name}
                  </Heading>

                  <VStack align="stretch" gap={1} mb={3}>
                    <Flex align="center" gap={1.5} fontSize="xs" color="gray.600">
                      <MapPin size={12} color="#000000" />
                      <Text fontWeight="semibold" color="black">HQ:</Text> {org.headquarters}
                    </Flex>
                    {org.regional_office && (
                      <Flex align="center" gap={1.5} fontSize="xs" color="gray.600">
                        <Globe size={12} color="#71717a" />
                        <Text fontWeight="semibold" color="gray.800">Regional:</Text> {org.regional_office}
                      </Flex>
                    )}
                  </VStack>

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
                    {org.description}
                  </Text>
                </Box>

                <Box borderTop="1px solid" borderColor="gray.100" pt={3} mt={2}>
                  {org.key_crop_domains && (
                    <Flex wrap="wrap" gap={1} mb={4}>
                      {org.key_crop_domains.slice(0, 4).map((d, idx) => (
                        <Text
                          key={idx}
                          fontSize="10px"
                          bg="gray.100"
                          color="gray.800"
                          px={2}
                          py={0.5}
                          borderRadius="sm"
                          fontWeight="medium"
                        >
                          #{d}
                        </Text>
                      ))}
                    </Flex>
                  )}

                  <Flex align="center" justify="space-between" flexWrap="wrap" gap={2}>
                    <HStack gap={2}>
                      {org.website_url && (
                        <a
                          href={org.website_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            paddingLeft: "10px",
                            paddingRight: "10px",
                            height: "26px",
                            borderRadius: "6px",
                            border: "1px solid #d4d4d8",
                            color: "#000000",
                            fontSize: "12px",
                            fontWeight: 500,
                            textDecoration: "none",
                            backgroundColor: "#ffffff",
                          }}
                        >
                          Website <ExternalLink size={10} style={{ marginLeft: 4 }} />
                        </a>
                      )}

                      {org.repository_url && (
                        <a
                          href={org.repository_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            paddingLeft: "10px",
                            paddingRight: "10px",
                            height: "26px",
                            borderRadius: "6px",
                            border: "1px solid #000000",
                            color: "#000000",
                            fontSize: "12px",
                            fontWeight: 500,
                            textDecoration: "none",
                            backgroundColor: "#ffffff",
                          }}
                        >
                          <BookOpen size={10} style={{ marginRight: 4 }} /> Repository
                        </a>
                      )}
                    </HStack>

                    <Button
                      size="xs"
                      variant="ghost"
                      color="gray.700"
                      _hover={{ bg: "gray.100", color: "black" }}
                      onClick={() => setInspectOrg(org)}
                      height="26px"
                      fontSize="xs"
                    >
                      <Eye size={12} style={{ marginRight: 4 }} /> Info
                    </Button>
                  </Flex>
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* Partner Inspection Modal */}
      {inspectOrg && (
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
                <Badge variant="outline" borderColor="black" color="black" fontSize="xs" fontWeight="bold" mb={1}>
                  {inspectOrg.acronym}
                </Badge>
                <Heading size="md" color="black" fontWeight="bold">
                  {inspectOrg.name}
                </Heading>
              </Box>
              <IconButton
                aria-label="Close modal"
                size="sm"
                variant="ghost"
                color="black"
                onClick={() => setInspectOrg(null)}
              >
                <X size={18} />
              </IconButton>
            </Flex>

            <Stack gap={4} mb={6}>
              <Flex gap={3} flexWrap="wrap">
                <Box bg="gray.50" p={3} borderRadius="lg" borderWidth="1px" borderColor="gray.200" flex="1" minW="160px">
                  <Text fontSize="10px" color="gray.500" fontWeight="bold" textTransform="uppercase">
                    Global Headquarters
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color="black">
                    {inspectOrg.headquarters}
                  </Text>
                </Box>

                {inspectOrg.regional_office && (
                  <Box bg="gray.50" p={3} borderRadius="lg" borderWidth="1px" borderColor="gray.200" flex="1" minW="160px">
                    <Text fontSize="10px" color="gray.500" fontWeight="bold" textTransform="uppercase">
                      Regional Africa Hub
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="black">
                      {inspectOrg.regional_office}
                    </Text>
                  </Box>
                )}
              </Flex>

              <Box>
                <Text fontSize="xs" fontWeight="bold" color="black" textTransform="uppercase" mb={1.5}>
                  Institutional Mandate & Mission
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
                >
                  {inspectOrg.description}
                </Box>
              </Box>

              <Box>
                <Text fontSize="xs" fontWeight="bold" color="black" textTransform="uppercase" mb={1.5}>
                  Key Crop & Advisory Domains
                </Text>
                <Flex wrap="wrap" gap={1.5}>
                  {inspectOrg.key_crop_domains?.map((d, idx) => (
                    <Badge key={idx} variant="outline" borderColor="black" color="black" fontSize="xs" px={2.5} py={0.5}>
                      {d}
                    </Badge>
                  ))}
                </Flex>
              </Box>

              <Box>
                <Text fontSize="xs" fontWeight="bold" color="black" textTransform="uppercase" mb={1.5}>
                  Raw Organization Record
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
                  {JSON.stringify(inspectOrg, null, 2)}
                </Box>
              </Box>
            </Stack>

            <Flex justify="flex-end" gap={3} pt={3} borderTop="1px solid" borderColor="gray.200">
              <Button
                size="sm"
                variant="outline"
                borderColor="gray.300"
                color="black"
                onClick={() => copyToClipboard(JSON.stringify(inspectOrg, null, 2), "organization JSON")}
              >
                <Copy size={14} style={{ marginRight: 6 }} /> Copy JSON
              </Button>
              <Button size="sm" bg="black" color="white" onClick={() => setInspectOrg(null)}>
                Close
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
  );
}
