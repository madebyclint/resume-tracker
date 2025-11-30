# Markdown Resume Prompt Validator

This validator ensures your resume meets the specific requirements of your Markdown generation prompt:

**"Generate a full Markdown resume that is fully ASCII-safe with:
- Only ONE divider line, placed immediately after the header and nowhere else in the document.
- Header compressed with bullet separators.
- Skills section using bullet points with bold category labels.
- No em dashes, no Unicode, and no fancy characters.
- Do NOT insert any additional dividers or horizontal rules anywhere else in the resume."**

## Validation Features

### ✅ What the Validator Checks

1. **Markdown Format**: Ensures the resume uses proper Markdown headers (`# Name`, `## Section`)
2. **Single Divider Rule**: Verifies exactly ONE divider line exists and it's placed after the header
3. **Divider Placement**: Confirms the divider comes immediately after the header/contact section
4. **Header Format**: Checks for bullet separators (• or |) in contact information
5. **Skills Section**: Validates bullet points with bold category labels (`**Category:** item`)
6. **ASCII Safety**: Identifies any non-ASCII characters and suggests replacements
7. **No Extra Dividers**: Ensures no additional horizontal rules exist in the document body

### 🔍 How to Use

1. **Automatic Validation**: Type in the Resume Formatter and see real-time validation
2. **Prompt Check Button**: Click "✓ Prompt Check" for focused validation against prompt requirements
3. **Combined Validation**: The full validation includes both general ATS checks and prompt-specific requirements

### 📝 Example Valid Format

```markdown
# John Smith
Email: john@email.com | Phone: (555) 123-4567 | LinkedIn: linkedin.com/in/johnsmith

---

## Summary
Experienced software developer with 5+ years...

## Skills
**Programming Languages:** JavaScript, Python, Java
- **Frameworks:** React, Node.js, Django  
- **Databases:** PostgreSQL, MongoDB, Redis

## Experience
### Software Developer
Company Name | 2020-2024
- Built and maintained web applications
- Collaborated with cross-functional teams
```

### ❌ Common Issues Detected

- **Multiple dividers**: `Found 3 divider lines - should be exactly ONE`
- **Non-ASCII characters**: `Non-ASCII character found: "—" (use regular dash -)`
- **Missing bold labels**: `Skills section missing bold category labels (**Category:**)`
- **Wrong divider placement**: `Divider must be placed immediately after header section`

### 🎯 Benefits

- Ensures resume matches your exact AI generation prompt requirements
- Prevents ATS parsing issues from special characters
- Maintains consistent formatting across all generated resumes
- Provides specific, actionable feedback for corrections

The validator integrates seamlessly with your existing resume workflow and helps maintain the strict formatting requirements needed for reliable AI generation.