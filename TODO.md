Here is a **verbose, structured Markdown task list** you can drop straight into your project README or planning doc.
Tasks are written for *your* workflow: you build, Copilot generates code.

---

# 📘 **Resume Builder MVP — Phase 1: Semantic Chunking System**

*Verbose Task List*

This phase focuses on transforming uploaded resumes/cover letters into **semantic chunks** stored in IndexedDB. These chunks form the foundation of JD analysis + resume generation in Phase 2.

---

## ## 📂 **1. PDF Upload Pipeline (Completed)**

* [x] Ability to upload PDFs.
* [x] Save uploaded file metadata into IndexedDB.

*(No further work here unless adding drag-and-drop or multi-file upload later.)*

---

# ## 🚀 **2. PDF → Text Extraction Layer**

### **2.1 Create a text extraction step**

* [x] After a PDF is uploaded, trigger a text extraction process.
* [x] Extract raw text from all pages (one continuous string).
* [x] Store extracted text into IndexedDB under the `sourceDoc` record.
* [x] Display a status indicator: "Text extracted ✓".

**Goal:** Every uploaded document must have extractable plain text ready for AI.

---

# ## 🤖 **3. AI Semantic Chunking Pipeline**

### **3.1 Add a “Parse into Chunks” action**

* [ ] On each uploaded document row, add a “Parse into Chunks” button.
* [ ] When pressed:

  * [ ] Retrieve extracted text.
  * [ ] Send text to AI with a strict JSON response schema.
  * [ ] Receive structured chunks: `type`, `text`, `tags`, `order`.
  * [ ] Temporarily store in memory (don’t auto-save yet).
* [ ] Present a success/failure state for AI response.

### **3.2 Create a chunk object model (conceptual)**

Each chunk should contain:

* `id` (uuid)
* `sourceDocId`
* `type` (summary, skills, experience_section, experience_bullet, mission_fit, cover_letter_intro, cover_letter_body, cover_letter_closing)
* `text`
* `tags` (AI-suggested)
* `order`
* `createdAt`

### **3.3 Build a post-AI review modal**

Before saving chunks:

* [ ] Show list of chunks in a modal or drawer.
* [ ] Show fields:

  * Chunk type
  * Chunk text
  * Tags (comma-separated)
  * Order
* [ ] Provide actions:

  * Approve ✓
  * Reject ✕
  * Edit text
  * Edit tags
  * Change type (dropdown)
* [ ] A “Save Selected Chunks” button writes all approved chunks to IndexedDB.

**Goal:** Prevent junk/incorrect chunk types from polluting your database.

---

# ## 📚 **4. Chunk Library Screen**

Create a dedicated screen for managing all chunks.

### **4.1 Basic library layout**

* [ ] Document selector (filter chunks by originating PDF).
* [ ] Chunk type filter (summary / bullets / skills / etc.).
* [ ] Table or card list of chunks.

### **4.2 Editing tools**

* [ ] Inline text editing.
* [ ] Inline tag editing.
* [ ] Dropdown for chunk type.
* [ ] Delete chunk button.

### **4.3 Persistence**

* [ ] Save edits back to IndexedDB on blur or save.
* [ ] Surface “Saved ✓” feedback.

### **4.4 Optional quality-of-life**

* [ ] Quick-search by text.
* [ ] Tag search.

---

# ## 🏷️ **5. Auto Tag Suggestions (Optional but Helpful)**

Add a lightweight tag enrichment step.

### **5.1 After chunk creation, trigger AI tag suggestions**

* [ ] Send each chunk’s text to AI in a small prompt:
  “Suggest 3–7 skill/domain tags for this content.”
* [ ] Show proposed tags in chunk-review modal.
* [ ] Let user edit/delete tags before saving.

**Goal:** Make future JD → chunk matching more accurate.

---

# ## 🗃️ **6. IndexedDB Storage Layer**

Ensure all entities are saved cleanly and consistently.

### **6.1 Data stores to maintain**

* [ ] `sourceDocs`
* [ ] `chunks`
* [ ] `parsedText` (or embed text into sourceDoc)

### **6.2 Create helper functions**

* [ ] Get all chunks
* [ ] Get chunks by document
* [ ] Update chunk
* [ ] Delete chunk
* [ ] Bulk insert chunks (for “Save Selected Chunks” action)

### **6.3 Add export/import capability**

* [ ] Button to export all IndexedDB data as JSON.
* [ ] Button to import a JSON file to restore state.

**This lets you back up your system before experimenting.**

---

# ## 🎯 **7. Post-Chunking Checkpoint**

After completing all above:

You will have a system where you can:

* Upload past resumes/CLs
* Extract text
* Generate AI-based semantic chunks
* Review, edit, and store those chunks
* Maintain a growing library of reusable professional content

This is the **complete foundation** for Phase 2 (JD analysis → chunk matching → resume generation).

---

# ✔️ **You’re ready for the next phase only after:**

* [ ] Chunks can be reliably stored and edited.
* [ ] Chunk library is reviewable and clean.
* [ ] You trust your chunk database.

Once you check those boxes, I’ll give you:

👉 **Phase 2: JD Analysis, Chunk Matching, and Resume Builder MVP**
(which includes your printable HTML template + the generation flow).

Just say:
**“Give me Phase 2 tasks.”**
