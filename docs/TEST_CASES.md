# Resume Tracker — Test Cases

All tests refer to the **Job Descriptions** tab unless noted otherwise. The purple **🧪 Test Job** button in the header creates pre-filled test data so you can skip manual entry.

---

## 1. Test Job Generator

| # | Step | Expected |
|---|------|----------|
| 1.1 | Click **🧪 Test Job** | A job (e.g., "Senior Software Engineer at Acme Corp") is added to the top of the list. Toast confirms. |
| 1.2 | Click **🧪 Test Job** again | A second job with a different template (WarpSpeed AI PM role) is added. |
| 1.3 | Click a third time | Third template (Meridian Health). Cycles back to the first on the 4th click. |
| 1.4 | Verify sequential ID | Each test job gets the next sequential ID. |
| 1.5 | Verify note item | Job's Notes panel shows a 🧪 auto note item: "Test job #N created — …" |

---

## 2. Status Changes → Auto Note Items

> Use a test job for this section.

| # | Step | Expected |
|---|------|----------|
| 2.1 | Open a test job in the side panel. Confirm Notes shows 1 auto note item. | ✓ |
| 2.2 | Change status to **Applied** via the status dropdown | Notes panel shows new ⚙ auto item: "Status changed from not_applied to applied" |
| 2.3 | Change status to **Interviewing → Screening** | Two new ⚙ items: status change + interview stage change |
| 2.4 | Change status to **Offered → Received** | New ⚙ items for status and offer stage |
| 2.5 | Note items are sorted newest-first | Most recent change at the top |
| 2.6 | Auto items show ⚙ icon; manual items show 💬 icon | Visually distinct |

---

## 3. Field Edits → Auto Note Items (Edit Modal)

| # | Step | Expected |
|---|------|----------|
| 3.1 | Open **Edit** modal for a test job | Modal opens with pre-filled fields |
| 3.2 | Change **Location** from "San Francisco, CA" to "Austin, TX" and save | Auto note item: `Location changed from "San Francisco, CA" to "Austin, TX"` |
| 3.3 | Change **Min Salary** and save | Auto note item: `Min salary changed from "160000" to "…"` |
| 3.4 | Change **Status** to "interviewed" in the modal and save | Auto note item for Status change |
| 3.5 | Make no changes and save | No new note items added |
| 3.6 | Change multiple fields at once and save | One note item per changed field, all same timestamp |

---

## 4. Key Dates (Edit Modal)

| # | Step | Expected |
|---|------|----------|
| 4.1 | Open Edit modal → **Key Dates** section | Shows Application Date, Start Date, Follow-up Date, Last Status Change fields |
| 4.2 | Set **Start Date** to a future date (e.g., next month) and save | Field persists; banner shows "starting [date]" |
| 4.3 | Set **Start Date** to a past date and save | Banner shows "since [date]" |
| 4.4 | Clear Start Date and save | Banner hides date suffix |
| 4.5 | Set **Application Date** and save | Field persists after modal close |
| 4.6 | Set **Last Status Change Date** and save | `lastActivityDate` is updated; reflected in table |

---

## 5. Manual Notes

| # | Step | Expected |
|---|------|----------|
| 5.1 | Click **📅 Interview** quick-note button | A 💬 note item appears: "Interview scheduled" |
| 5.2 | Click **🔔 Follow up** | 💬 note item: "Follow up needed" |
| 5.3 | Click **✕ Rejected** | 💬 note item: "Rejected" |
| 5.4 | Click **✏️ Edit**, type a note, click **Save** | Legacy free-form notes block updates below the note items list |
| 5.5 | Click **✏️ Edit**, clear all text, click **Save** | Free-form notes block disappears; note items list still shows |
| 5.6 | No notes and no note items | Shows placeholder "No notes yet…" |

---

## 6. Celebration Modal (Accepted Offer)

| # | Step | Expected |
|---|------|----------|
| 6.1 | Set a job's status to **Offered** then offer stage to **Accepted** | Full-screen overlay fades in with 🎊, company name, role title |
| 6.2 | Wait 3 seconds without interaction | Overlay fades out automatically |
| 6.3 | Click the background overlay before timeout | Modal dismisses immediately |
| 6.4 | Progress bar | Green bar depletes over 3 seconds |
| 6.5 | Trigger celebration, immediately trigger again (different job) | Previous modal dismissed, new one appears |

---

## 7. Accepted Job Banner

| # | Step | Expected |
|---|------|----------|
| 7.1 | Set any job's offer stage to **Accepted** | Green banner appears above the jobs table: "Current job — **Title** at **Company**" |
| 7.2 | No start date set | Banner shows title + company only, no date suffix |
| 7.3 | Set start date to a future date | Banner shows "starting [Month D, YYYY]" |
| 7.4 | Set start date to a past date | Banner shows "since [Month D, YYYY]" |
| 7.5 | Click the banner | Selects that job in the detail panel |
| 7.6 | Change two jobs to Accepted | Banner shows the first one found (consistent — doesn't flicker) |
| 7.7 | Change offerStage away from Accepted | Banner disappears |

---

## 8. Job Management Table

| # | Step | Expected |
|---|------|----------|
| 8.1 | Click any column header (Company, Status, etc.) | Rows sort by that column; arrow indicator shown |
| 8.2 | Click same header again | Sort direction toggles |
| 8.3 | Type in the search box | List filters in real-time by company, title, role, location, or source |
| 8.4 | Enable **Hide rejected applications** | Rejected jobs disappear from list |
| 8.5 | Enable **Show archived jobs** | Archived jobs appear with distinct styling |
| 8.6 | Enable **Show only waiting for response** | Only jobs with waitingForResponse=true shown |
| 8.7 | Click status badge dropdown on a row | Status options appear; selecting one saves immediately |
| 8.8 | Click a row | Detail panel opens on the right; layout switches to split view |
| 8.9 | Click the same row again | Detail panel closes; layout returns to full width |
| 8.10 | Set **Status Filter** dropdown | Only jobs with that status are shown |

---

## 9. Edit Modal

| # | Step | Expected |
|---|------|----------|
| 9.1 | Click the edit (pencil) icon on a row | Edit modal opens pre-populated with job data |
| 9.2 | Change job title and click **Save Changes** | Title updates in list; auto note item logged |
| 9.3 | Add a required skill and save | Skill appears in extracted info |
| 9.4 | Remove all required skills and save | Required skills list is empty |
| 9.5 | Click **Cancel** with unsaved changes | Modal closes; no changes saved |
| 9.6 | Clear a required field (e.g., Job Title) and save | Validation should prevent save or show warning |

---

## 10. Archive / Delete

| # | Step | Expected |
|---|------|----------|
| 10.1 | Click Archive on a job | Job disappears from default list; toast confirms |
| 10.2 | Enable **Show archived jobs** | Archived job reappears with "Archived" label |
| 10.3 | Click Unarchive | Job returns to normal list |
| 10.4 | Click Delete on a job → confirm dialog | Job is permanently removed; toast confirms |
| 10.5 | Click Delete → cancel | Job remains |

---

## 11. Analytics Tab

| # | Step | Expected |
|---|------|----------|
| 11.1 | Click **Analytics** tab | Dashboard renders without errors |
| 11.2 | Stats section shows counts | Total, Applied, Interviewing, etc. reflect current data |
| 11.3 | Activity chart renders | Bar chart shows application activity by week |
| 11.4 | Create a test job → check Analytics | Total count increments |

---

## 12. CSV Import

| # | Step | Expected |
|---|------|----------|
| 12.1 | Click **Import CSV** | Modal opens with field-mapping UI |
| 12.2 | Upload a valid CSV | Row preview appears; field mapping suggested |
| 12.3 | Confirm import | Jobs added to list; toast shows count |
| 12.4 | Upload invalid/empty CSV | Error message shown inside modal |

---

## 13. Data Export / Import

| # | Step | Expected |
|---|------|----------|
| 13.1 | Click **Export Data** | JSON file downloads containing all resumes, cover letters, and job descriptions |
| 13.2 | Click **Import Data** and select the exported file | All data restored; existing data merged/replaced per app logic |

---

## 14. Job Scraper Modal

| # | Step | Expected |
|---|------|----------|
| 14.1 | Click **+ Add Job** | Scraper modal opens |
| 14.2 | Paste raw job description text → Submit | Job parsed and added to list with extracted info |
| 14.3 | Enter a valid job URL → Fetch | URL content fetched; fields pre-populated |
| 14.4 | Enter an invalid URL | Error displayed in modal |
| 14.5 | Upload a PDF file | Text extracted from PDF; job fields populated |

---

## 15. Action Reminders Panel

| # | Step | Expected |
|---|------|----------|
| 15.1 | Jobs in "applied" status for >2 days | Reminder badge/panel suggests "Follow up" |
| 15.2 | Click **Complete** on a reminder | Action marked done; removed from panel |
| 15.3 | Click **Snooze** on a reminder | Reminder hidden until snooze expires |
| 15.4 | Open Reminder Settings | Panel to configure thresholds per action type |

---

## 16. Waiting for Response Flag

| # | Step | Expected |
|---|------|----------|
| 16.1 | Toggle **Waiting for Response** on a job | Flag icon appears on that row |
| 16.2 | Enable the "show only waiting" filter | Only flagged jobs shown |
| 16.3 | Toggle the flag off | Job removed from filtered view |

---

## 17. Duplicate Detection

| # | Step | Expected |
|---|------|----------|
| 17.1 | Add same company+role twice | Duplicate detection modal may appear |
| 17.2 | Mark a job as duplicate of another | Marked job shows "Duplicate" status and link to original |
| 17.3 | View original from duplicate | Clicking link selects original job |

---

## 18. Edge Cases

| # | Scenario | Expected |
|---|----------|----------|
| 18.1 | Accept a job, refresh the page | Banner persists (data reloaded from IndexedDB) |
| 18.2 | Accept a job with no startDate, then add startDate | Banner updates in-place |
| 18.3 | Rapidly change status multiple times | Each change generates a distinct note item with its own timestamp |
| 18.4 | Note items list with 20+ items | All items render; scroll works; no layout breaks |
| 18.5 | Very long company/title in celebration modal | Text wraps gracefully; card doesn't overflow viewport |
| 18.6 | Create test job when no existing jobs | sequentialId = 1 |
| 18.7 | Open edit modal, change startDate, close without saving | startDate unchanged |
