# Chilimba User Guide

**Version:** Phase 1 (2026)  
**For:** Group owners, treasurers, and members in Zambia

This guide tells you **what each button does** and **what to expect** on every main screen — so you can use the app without guessing.

---

## How to read this guide

Each screen lists:

| Column | Meaning |
|--------|---------|
| **Button** | The exact label you see in the app |
| **What it does** | What happens when you tap it |
| **What to expect** | Success result, redirect, or common error |

**Roles:** **Owner** runs the group. **Treasurer** records money. **Member** pays and uploads proof.

---

## 1. Sign in & sign up

### Sign up (`/signup`)

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **Send verification code** | Creates your account and sends an OTP | You go to the OTP screen. Button shows “Sending code…” while waiting. Disabled until name, phone, password, and consent are filled correctly. |
| **Sign in** (link) | Opens the login page | Login screen |

### Verify phone (`/otp`)

| Control | What it does | What to expect |
|---------|--------------|----------------|
| **6 digit boxes** | Submits the code automatically when all 6 digits are entered | Success → **Dashboard**. Wrong code → red error under the boxes. |
| **Resend code** | Sends a new OTP | Button disabled for 60 seconds after each send. Shows “Resend code in Xs” during cooldown. |
| **← Use a different number** | Goes back to sign up | Sign up page |

### Sign in (`/login`)

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **Sign in** | Logs you in with phone + password | Success → **Dashboard** (or the page you were trying to open). Error shown in red on the form. |
| **Verify your phone →** | Appears only if your phone is not verified yet | Takes you to the OTP screen |
| **Create one** (link) | Opens sign up | Sign up page |
| **Moon / Sun** (top-right) | Toggles light or dark mode | Theme changes immediately and is saved on this device |

---

## 2. App menu (every logged-in page)

The left sidebar and top bar appear on Dashboard, invoices, group pages, and Help.

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **Dashboard** | Opens your home screen | Summary of invoices and group shortcuts |
| **My invoices** | Opens your Chilimba subscription invoices | List of pending and paid invoices |
| **My group** | Opens your savings group | Your group detail page (or “no group yet” if you have not created one) |
| **User guide** | Opens this help page in the app | In-app guide + PDF download |
| **Moon / Sun** (header) | Toggles light / dark mode | Theme switches |
| **Sign out** | Ends your session | Login page. You must sign in again. |
| **Menu** (mobile only) | Opens / closes the sidebar | Sidebar slides in; tap outside to close |

---

## 3. Dashboard (`/dashboard`)

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **My invoices** (card) | Opens invoice list | See pending and paid counts; tap an invoice to pay or upload proof |
| **My group** (card) | Opens your group | Group detail with members, cycles, reports |
| **Cycles** (card) | Opens cycle management | Only shown if you already have a group |
| **Reports** (card) | Opens reports | Cycle summary, outstanding, payout ledger, PDF download |

**On load:** The page fetches your invoices and group. Cards show live counts (e.g. “1 pending · 2 paid”).

---

## 4. My invoices (`/invoices`)

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **Each invoice row** | Opens that invoice | Invoice detail with payment instructions and upload area |
| **pending** badge | Display only | You still need to pay and upload proof |
| **paid** badge | Display only | Invoice cleared — you can create your group via WhatsApp link |

**Empty state:** “No invoices yet” — contact your Chilimba admin.

---

## 5. Invoice detail (`/invoices/:id`)

Shown when an invoice is **pending**.

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **All my invoices** | Back to list | Invoice list |
| **Copy** (payment card) | Copies account number to clipboard | Button briefly shows **Copied** |
| **browse** / drag-and-drop zone | Selects a proof file | JPG, PNG, or PDF up to 10 MB |
| **Upload** | Sends your proof-of-payment (POP) | Success message: “Uploaded! Our team will review…” Status becomes **pending** until admin approves |

**After admin approves:** You receive a WhatsApp link to **create your group**.

---

## 6. Create your group (`/create-group?token=…`)

Opened from the WhatsApp link after your invoice is paid. No sidebar on this page.

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **Rotating cash / Grocery / Custom** | Picks a template | Form fields adjust to the template |
| **Create group** | Submits the new group | Success screen: “Welcome aboard, {your name}!” |
| **Sign in** (success screen) | Login with redirect to your group | After login → **My group** |
| **Back to sign in** (invalid token) | Login page | Shown if the link expired or was already used |

---

## 7. My group (`/groups/:id`)

### Top action buttons

| Button | Who sees it | What it does | What to expect |
|--------|-------------|--------------|----------------|
| **Cycles** | Everyone | Opens cycles page | Contributions, payouts, progress bar |
| **Reports** | Everyone | Opens reports | Summaries and payout ledger PDF |
| **Loans** | Everyone (if loans enabled) | Opens loans page | Request and track loans |
| **Settings** | **Owner only** | Opens group settings | Contribution amount, WhatsApp, reminders |

### Tabs

| Tab | What to expect |
|-----|----------------|
| **Overview** | Grace period, late penalty, max members, loan rules |
| **Members** | List of everyone in the group |

### Members tab buttons

| Button | Who sees it | What it does | What to expect |
|--------|-------------|--------------|----------------|
| **Add member** | Owner or treasurer | Opens “Add a member” dialog | New member added; they get a WhatsApp invite |
| **Remove** (trash icon) | Owner only | Removes a member (not the owner) | Confirm dialog → member disappears from list |

**Add member dialog:**

| Button | What to expect |
|--------|----------------|
| **Add** | Member created; dialog closes |
| **Cancel** / **×** | Dialog closes, nothing saved |

---

## 8. Group settings (`/groups/:id/settings`)

**Owner only.** Non-owners are sent back to My group.

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **Back to group** | Returns to group detail | My group page |
| **Save changes** | Saves all settings on the form | Green “✓ Settings saved.” for ~2 seconds. Red text if validation fails. |

### WhatsApp group section

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **Refresh groups** | Loads WhatsApp groups the Chilimba bot can see | Dropdown fills with group names. If empty: add the Chilimba number to your WhatsApp group first, wait a minute, refresh again. |
| **Send verification code to group** | Posts a 6-digit code in the selected WhatsApp group | Verify step appears. Check the group chat for the code. |
| **Verify & link group** | Confirms you own the group | “Linked to {group name}.” Announcements will post to that chat. |
| **Choose different group** | Goes back to group picker | Select another group and resend code |
| **Disconnect** | Unlinks the WhatsApp group | “WhatsApp group disconnected.” |

**Before linking:** Add the Chilimba WhatsApp number (shown on screen, e.g. +260…) to your savings group chat.

---

## 9. Cycles (`/groups/:id/cycles`)

This is where you run each savings round.

### Cycle header buttons

| Button | Who | What it does | What to expect |
|--------|-----|--------------|----------------|
| **Open cycle** | Owner | Creates a new cycle with all months | Cycle appears with status **open**. Months and due dates are set. |
| **Start** | Owner | Begins collections | Status **in progress**. Members notified on WhatsApp. |
| **Complete** | Owner | Ends the cycle early | Confirm dialog → cycle marked **completed** |
| **Refresh** | Everyone | Reloads cycle data | Latest contributions and payouts |

### Month tabs (e.g. “Month 1 (Jul 2026)”)

| Action | What to expect |
|--------|----------------|
| Tap a month | That month’s contributions and payouts load in the panels below |

**Progress bar:** Shows “Month X of Y” and how far through the cycle you are.

### Per-member contribution buttons

| Button | Who | What it does | What to expect |
|--------|-----|--------------|----------------|
| **POP** | Member (own row), owner, treasurer | Upload proof-of-payment file | File attached; treasurer can **Approve POP** |
| **Record** | Owner or treasurer | Marks contribution as paid (cash) | Status becomes **Paid** |
| **Approve POP** | Owner or treasurer | Approves uploaded proof | Status becomes **Paid** |
| **Waive** | Owner only | Forgives the contribution | Status becomes **Waived** |

### Payouts panel (right side)

| Button | Who | What it does | What to expect |
|--------|-----|--------------|----------------|
| **Pick recipients** | Owner (manual payout mode) | Opens recipient picker | Choose exactly the number of recipients for this month |
| **Reroll recipients** | Owner (random payout mode) | Picks new random recipients | Payout list updates |
| **Record payout** | Owner or treasurer | Marks payout as sent | Optional notes and receipt file. Recipients notified on WhatsApp. Status **paid** |

**Pick recipients dialog:**

| Button | What to expect |
|--------|----------------|
| Checkboxes | Select up to “payout recipients per round” members |
| **Save recipients** | Modal closes; payout amounts appear |
| **Cancel** | Nothing saved |

**Typical flow each month:**

1. Members pay → upload **POP** or treasurer taps **Record**
2. Treasurer **Approve POP** if needed
3. Owner **Pick recipients** (manual mode) or wait for queue/random
4. Treasurer **Record payout** when money is sent

---

## 10. Reports (`/groups/:id/reports`)

Read-only — no money is recorded here.

| Tab | What to expect |
|-----|----------------|
| **Cycle summary** | Total collected, paid out, balance per month |
| **Outstanding** | Who still owes for the active month |
| **Member statements** | Pick a member from dropdown → their contributions and payouts |
| **Loan book** | Active loans and balances |
| **Payout ledger** | Table: Month \| Recipients \| Amount \| Status |

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **Download PDF** | Exports payout ledger | PDF file downloads. Shows “Generating…” while busy. Only on **Payout ledger** tab when rows exist. |

---

## 11. Loans (`/groups/:id/loans`)

Only if **Allow members to take loans** is on in settings.

| Button | Who | What it does | What to expect |
|--------|-----|--------------|----------------|
| **Request loan** | Eligible member | Opens request dialog | Enter amount + purpose → loan status **pending** |
| **Approve** | Owner or treasurer | Approves pending loan | Loan becomes **active** |
| **Reject** | Owner or treasurer | Rejects with a reason | Loan **rejected** |
| **Record** | Owner or treasurer | Logs a repayment | Outstanding balance decreases |

**Request loan dialog:** **Submit** sends request; **Cancel** closes without saving.

---

## 12. User guide in the app (`/help`)

| Button | What it does | What to expect |
|--------|--------------|----------------|
| **Download PDF manual** | Downloads this guide as PDF | File `user-manual.pdf` — share with members on WhatsApp |
| Accordion sections | Expand / collapse help topics | Quick reminders; full detail is in the PDF |

---

## 13. User stories — day in the life

### Story A: New group owner (Grace)

1. **Sign up** → enter OTP → land on **Dashboard**
2. **My invoices** → open pending invoice → **Copy** payment number → pay on phone → **Upload** POP
3. Wait for admin approval → open WhatsApp **create group** link → **Create group**
4. **Sign in** → **My group** → **Settings** → set K500 monthly, 1 recipient → **Save changes**
5. **Settings** → add Chilimba number to WhatsApp → **Refresh groups** → **Send verification code** → **Verify & link group**
6. **Members** tab → **Add member** for treasurer
7. **Cycles** → **Open cycle** → **Start**
8. Each month: members **POP** or treasurer **Record** → **Record payout**

### Story B: Treasurer (James)

1. **Sign in** → **My group** → **Cycles**
2. Select current month tab
3. When a member uploads proof: tap **Approve POP**
4. For cash payments: tap **Record**
5. When all contributions are in: fill payout notes → **Record payout**

### Story C: Member (Mary)

1. **Sign in** → **My group** → **Cycles**
2. Find your name → tap **POP** → upload mobile money screenshot
3. Wait for treasurer to approve
4. Check **Reports** → **Member statements** to see your history

---

## 14. Troubleshooting

| Problem | What to do |
|---------|------------|
| **Sign in** does nothing / error | Check phone format (`096…` or `+260…`) and password |
| Logged out after closing browser | **Sign in** again — session is saved per device after login |
| “Not a member of this group” | Use **Dashboard** → **My group**, not an old bookmark |
| **Settings** not visible | Only the **owner** sees the Settings button |
| **Save changes** fails | Check required fields; only owner can save |
| **Refresh groups** shows nothing | Add Chilimba WhatsApp number to your group chat, wait 1 minute, refresh |
| **Verify & link group** fails | Code expires in 10 minutes — **Send verification code** again |
| **Record payout** disabled | Assign recipients first; ensure contributions are recorded |
| No **Cycles** card on Dashboard | You need a group first — pay invoice and create group |

---

## 15. Support

Contact your Chilimba administrator or the person who sent your invoice.

---

*Chilimba — digital savings groups for Zambia.*