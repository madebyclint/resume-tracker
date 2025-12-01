import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faExclamationTriangle, faTimes } from '@fortawesome/free-solid-svg-icons';

interface ValidationMessageProps {
  message: string;
}

const ValidationMessage: React.FC<ValidationMessageProps> = ({ message }) => {
  // Parse the message to extract line links and replace Unicode symbols with Font Awesome icons
  const parseMessage = (text: string): React.ReactNode => {
    // First replace Unicode symbols with Font Awesome icons
    let processedText = text
      .replace(/✓/g, '__CHECK__')
      .replace(/✗/g, '__ERROR__')
      .replace(/❌/g, '__ERROR__');

    // Regex to match: Line <a href="#line-X">X</a>
    const linkRegex = /Line <a href="#line-(\d+)">(\d+)<\/a>/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(processedText)) !== null) {
      // Add text before the link (with icon replacements)
      if (match.index > lastIndex) {
        const textPart = processedText.slice(lastIndex, match.index);
        parts.push(...parseTextWithIcons(textPart, parts.length));
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

    // Add any remaining text after the last link (with icon replacements)
    if (lastIndex < processedText.length) {
      const textPart = processedText.slice(lastIndex);
      parts.push(...parseTextWithIcons(textPart, parts.length));
    }

    // If no links were found, return the text with icon replacements
    return parts.length > 0 ? parts : parseTextWithIcons(processedText, 0);
  };

  const parseTextWithIcons = (text: string, baseKey: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const segments = text.split(/(__CHECK__|__WARNING__|__ERROR__)/);

    segments.forEach((segment, index) => {
      if (segment === '__CHECK__') {
        parts.push(<FontAwesomeIcon key={`${baseKey}-check-${index}`} icon={faCheck} className="validation-icon success" />);
      } else if (segment === '__WARNING__') {
        parts.push(<FontAwesomeIcon key={`${baseKey}-warning-${index}`} icon={faExclamationTriangle} className="validation-icon warning" />);
      } else if (segment === '__ERROR__') {
        parts.push(<FontAwesomeIcon key={`${baseKey}-error-${index}`} icon={faTimes} className="validation-icon error" />);
      } else if (segment) {
        parts.push(segment);
      }
    });

    return parts;
  };

  return <>{parseMessage(message)}</>;
};

export default ValidationMessage;