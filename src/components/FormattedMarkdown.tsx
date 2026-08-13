import React from "react";
import { Box, Text, VStack } from "@chakra-ui/react";

interface FormattedMarkdownProps {
  content: string;
  color?: string;
}

export default function FormattedMarkdown({ content, color }: FormattedMarkdownProps) {
  if (!content) return null;

  const lines = content.split("\n");

  const renderInlineMarkdown = (text: string) => {
    // Regex for bold **text** and italic *text*
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <Text as="span" key={idx} fontWeight="bold" color={color ? undefined : "black"}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return (
          <Text as="span" key={idx} fontStyle="italic" opacity={0.9}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <VStack align="stretch" gap={1.5}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Header 1 (# )
        if (trimmed.startsWith("# ")) {
          return (
            <Text key={idx} fontSize="md" fontWeight="bold" color={color ? undefined : "black"} mt={2} mb={0.5}>
              {renderInlineMarkdown(trimmed.slice(2))}
            </Text>
          );
        }

        // Header 2 (## )
        if (trimmed.startsWith("## ")) {
          return (
            <Text key={idx} fontSize="sm" fontWeight="bold" color={color ? undefined : "black"} mt={2} mb={0.5}>
              {renderInlineMarkdown(trimmed.slice(3))}
            </Text>
          );
        }

        // Header 3 (### )
        if (trimmed.startsWith("### ")) {
          return (
            <Text key={idx} fontSize="xs" fontWeight="bold" color={color ? undefined : "gray.800"} mt={1.5} mb={0.5}>
              {renderInlineMarkdown(trimmed.slice(4))}
            </Text>
          );
        }

        // Bullet points (- or * or •)
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
          const bulletText = trimmed.replace(/^[-*•]\s+/, "");
          return (
            <Box key={idx} pl={2.5} borderLeft="2px solid" borderColor={color ? "whiteAlpha.400" : "gray.300"} py={0.5}>
              <Text fontSize="sm" lineHeight="relaxed" color={color || "gray.800"}>
                {renderInlineMarkdown(bulletText)}
              </Text>
            </Box>
          );
        }

        // Numbered list (1. 2. 3.)
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s+(.*)/);
          if (match) {
            return (
              <Box key={idx} pl={1} py={0.5}>
                <Text fontSize="sm" lineHeight="relaxed" color={color || "gray.800"}>
                  <Text as="span" fontWeight="bold" mr={1.5}>
                    {match[1]}
                  </Text>
                  {renderInlineMarkdown(match[2])}
                </Text>
              </Box>
            );
          }
        }

        // Regular paragraph line
        return (
          <Text key={idx} fontSize="sm" lineHeight="relaxed" color={color || "gray.800"}>
            {renderInlineMarkdown(line)}
          </Text>
        );
      })}
    </VStack>
  );
}
