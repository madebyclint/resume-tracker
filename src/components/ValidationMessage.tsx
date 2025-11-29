import React from 'react';

interface ValidationMessageProps {
  message: string;
}

const ValidationMessage: React.FC<ValidationMessageProps> = ({ message }) => {
  // Parse the message to extract line links and render them as proper React elements
  const parseMessage = (text: string): React.ReactNode => {
    // Regex to match: Line <a href="#line-X">X</a>
    const linkRegex = /Line <a href="#line-(\d+)">(\d+)<\/a>/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add the clickable line link as a React element
      const lineNumber = match[2];
      parts.push(
        <a
          key={`line-${lineNumber}-${match.index}`}
          href={`#line-${lineNumber}`}
          className="line-link"
        >
          Line {lineNumber}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last link
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    // If no links were found, return the original text
    return parts.length > 0 ? parts : text;
  };

  return <>{parseMessage(message)}</>;
};

export default ValidationMessage;