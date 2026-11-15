# SATYAM GOLD — Collection App 📒

Mobile-fit collection app. Cloudflare Pages पर चलता है, data main app (gcpmsk/8th) वाले **same PostgreSQL** database में जाता है.

## क्या-क्या है

### Owner login (Mobile + Password)
| Button | काम |
|---|---|
| 📅 DAY TO DAY | तारीख़ चुनें → सारे payment (Cash/Online/Mix), हर line पर **किसने लिया** (OTP user का नाम), नीचे **📄 PDF** button — PDF preview / Download / Share. PDF में हर row के side में collector का नाम + "कौन ने कितना" summary |
| 🔍 NAME / ADDRESS SEARCH | customer का पूरा हिसाब — **Due (बिल) + Paid** दोनों, तारीख़ वार, total बाक़ी |
| 💰 ADD CUSTOMER AMOUNT | ऊपर बाएँ search, दाएँ **Area select** → उस area के customer A-Z serial wise → click → profile |
| ✏️ UPDATE PAYMENT (UPC) | back-date payment, Mode **Online / Cash** |
| 🛒 TODAY ORDERS | आज के सारे order (Owner: तारीख़ चुन सकता है) |
| 🔔 PAYMENT REMINDER | जिन customer ने **"बाद में"** बोला — **तारीख़ + समय** के साथ, समय हो जाए तो लाल ⏰ + menu पर count badge |
| 🔑 OTP LOGIN USERS | नया user: **User का नाम (PDF), Area allow (या All), Logout time** → OTP बनता है (**2 मिनट valid**, expire होते ही नया OTP अपने-आप). Short Name हटा दिया गया |
| 🚫 NOT VISIT | OTP user ने जो area खोला, उसमें किस customer की profile नहीं खोली (miss) — due के साथ |

"Add Customer" button हटा दिया गया है (customer main app से आते हैं).

### OTP login (मुंशी)
* **ADD CUSTOMER AMOUNT**, **TODAY COLLECTION** (अपना Cash / Online / Total), **TODAY ORDERS**, **PAYMENT REMINDER**
* सिर्फ़ allowed area ही दिखेंगे (customer, order, reminder — सब उसी area तक)
* **Refresh करने पर logout नहीं** — session localStorage + cookie दोनों में रहता है, और refresh के बाद उसी area / customer profile पर वापस. Logout सिर्फ़: Owner ⏻ दबाए, logout time, या रात 12 बजे. Internet टूटने / server error से कभी logout नहीं
* **📦 PACK (live):** जब कोई user किसी customer पर **PAID / बाद में / ORDER** कर दे तो बाक़ी users को list में उसके नाम के साथ लाल **📦 PACK · नाम · क्या हुआ** दिखता है (हर 7 सेकंड में अपने-आप update). सिर्फ़ profile खोल कर back करने पर **PACK नहीं** होता
  * PACK customer पर दूसरे user का **ORDER** हमेशा खुला; **PAID / बाद में** के लिए PAID बटन पर **3 बार जल्दी tap** करना पड़ता है (गलती से दोबारा पैसे न चढ़ें)
* रात **12 बजे अपने-आप logout** (या Owner का set किया logout time — जो पहले हो). अगले दिन नया OTP, पुराना कुछ नहीं दिखेगा
* Owner ⏻ से किसी को भी तुरंत logout कर सकते हैं

### Customer profile
* ऊपर: **नाम (पता)** और उसके नीचे database वाला **current rate** (Master ± Area ± customer special — main app Set Rate से)
* बाएँ: किस तारीख़ का कितना due बाक़ी (FIFO), नीचे **Total Due**
* दाएँ: **💵 PAID** → Cash / Online / Mix / ⏳ बाद में
* दाएँ: **🛒 ORDER** → Atta 5/10/18/23/48kg, Sattu 500g/200g, Besan 500g/200g, हर item पर **थैला / बोरा**, या **⏳ अभी नहीं**

### Main app से जुड़ाव
* Payment → main app notebook **जमा खाते नाम** (`sg_nb_<date>.jama`) में अपने-आप — Debtor balance घट जाता है
* Order → main app **Order Book** (`sg_ord_<date>`) में — **पूरी row Dark Orange** (WhatsApp = हरा, Collection = Dark Orange)
* Notebook **जमा खाते नाम** में Collection से आई entry का **नाम Dark Orange** (Online/A/C वाली entry लाल ही रहती है)
* Collection **PDF** में "किसने पैसे लिए" — OTP user का पूरा नाम (जो Owner ने OTP user बनाते समय भरा)

---

## 🚀 Live करने का तरीका (Cloudflare Pages)

### 1) PostgreSQL (Adminer) — SQL paste
Adminer खोलें (`http://140.245.7.25:5051`) → DB `postgres`, Schema `public` → **SQL command** →
इस repo की `schema.sql` file का पूरा text paste करें → **Execute**. (पहले से चल रहे app के लिए यही दोबारा चलाना safe है — सिर्फ़ नए `coll_later`, `coll_packs` tables बनेंगे, पुराना data वैसा ही रहेगा.)
(App पहली बार चलते ही भी tables बना लेता है, पर एक बार चला देना अच्छा है.)

### 2) Cloudflare Pages project
1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**
2. GitHub repo **gcpmsk/Collection-satyam** चुनें, branch `main`
3. Build settings:
   * Framework preset: **None**
   * Build command: `npm install`   (ख़ाली भी चलेगा)
   * Build output directory: `.`
4. **Environment variables (Settings → Variables and Secrets)** — Production में:

| Name | Value |
|---|---|
| `DATABASE_URL` | main app वाला same — `postgresql://postgres:PASSWORD@140.245.7.25:5432/postgres` |
| `SESSION_SECRET` | कोई भी लंबा random text (जैसे `sg-coll-8f3k29dk...`) — **Secret** type |
| `ADMIN_MOBILE` | `9631816666` (optional) |
| `ADMIN_PASS` | अपना password (optional, default `Satyam` — बदल लें) |

5. **Save and Deploy**. Variables बदलने के बाद **Deployments → Retry deployment** करें.
6. Check: `https://<project>.pages.dev/api/health` → `{"ok":true,"db":true}` आना चाहिए.

> Postgres server का port (5432) internet से खुला होना चाहिए (main app में जो चल रहा है वही काफ़ी है). Cloudflare पर database नहीं बनाना — सिर्फ़ `DATABASE_URL` देना है.

### 3) Main app (gcpmsk/8th)
`orderbook.js` + `index.html` में छोटा बदलाव है (Order Book पर 📒 collection tag). उसे push करते ही main app का Cloudflare project अपने-आप redeploy हो जाएगा.

## Files
* `index.html`, `style.css`, `app.js` — frontend
* `functions/api/[[path]].js` — सारा API (`/api/login`, `/api/customers`, `/api/customer`, `/api/pay`, `/api/order`, `/api/day`, `/api/orders`, `/api/later`, `/api/laters`, `/api/later/done`, `/api/packs`, `/api/agents*`, `/api/notvisit`, `/api/health`)
* `schema.sql` — Adminer में paste करने वाला SQL

## 🧾 WhatsApp Receipt (auto) + double-payment guard
Payment Save hote hi customer ko Meta template `satyam_payment_receipt` automatic jaata hai (ek payment = ek receipt). Save par double click / network retry se ab 2 payment nahi banti (`req_id`). Failed receipts main app me 💬 WhatsApp → 🧾 Receipts me dikhti hain. Pura setup: `WHATSAPP-RECEIPT-SETUP.md`. Cloudflare env: `WA_TOKEN`, `WA_PHONE_ID`, `WA_RECEIPT_PARAMS`.
