# 🏠 FlatMate-AI — Smart Agentic Roommate Expense System

> **Pak Angels Generative & Agentic AI Training — Cohort 11 Hackathon Project**

FlatMate-AI is an intelligent, multi-agent financial assistant and automated expense management platform built for shared living spaces (bachelor flats, student accommodations, and shared apartments). It eliminates financial friction, automates debt settlements, and promotes smart budgeting.

---

## 🌟 Key Features

### 📸 1. Generative AI Receipt & Bill OCR Scanner
* Upload or snap photos of paper receipts, restaurant bills, or utility invoices.
* Powered by **Groq Cloud AI (`llama-3.2-11b-vision-preview`)** & **Google Gemini 1.5 Flash Vision** with built-in zero-cost heuristic fallback.
* Auto-extracts store/vendor names, total amount, category, and items into the expense form.

### 🎙️ 2. Voice & Natural Language Assistant
* Native **Web Speech API** integration.
* Speak expenses naturally in English, Urdu, or Roman Urdu (*"Paid 2500 PKR for groceries split with Ali"*).
* Powered by **Groq `llama-3.3-70b-versatile`**.

### 🤖 3. Multi-Agent Control Center (3 Autonomous AI Agents)
1. 🔍 **Expense Auditor Agent**: Detects transaction anomalies, duplicate bills, and single-member spending load imbalances (>60% paid by 1 roommate).
2. ⚖️ **Debt Minimizer Agent**: Implements a **Greedy Debt Graph Minimization Algorithm** to reduce multi-party split debts to the minimum number of direct bank transfers.
3. 🥗 **Budget Advisor Agent**: Analyzes category distribution (Food vs Utilities vs Rent) and generates cost-saving tips.

### ⚡ 4. Business Process Automation (BPA)
* 1-click automated **WhatsApp Payment Reminders** (`https://wa.me/?text=...`) for pending roommate debts.

---

## 🛠️ Tech Stack
* **Frontend**: React 18, Vite, Tailwind CSS v4, Lucide Icons
* **Backend**: Vercel Node.js Serverless Master Function (`api/index.js`) & FastAPI (`api/index.py`)
* **Database**: Neon PostgreSQL Serverless
* **AI Models**: Groq Cloud AI (`llama-3.3-70b-versatile`, `llama-3.2-11b-vision-preview`), Google Gemini 1.5 Flash Vision, Custom Heuristic OCR Parser

---

## 🚀 Quick Start (Local Setup)

1. **Clone Repository**:
   ```bash
   git clone https://github.com/zohaibthaheem21/FlatMate-AI.git
   cd FlatMate-AI
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables** (`.env`):
   ```env
   DATABASE_URL='postgresql://neondb_owner:npg_oN0lRhJ2zank@ep-rough-truth-b5j6kb9l-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'
   GROQ_API_KEY='your_groq_api_key_here'
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 🎯 UN SDG Alignment
* **SDG 8**: Decent Work & Economic Growth (Financial literacy & budget management for youth)
* **SDG 12**: Responsible Consumption & Production (Reducing food/grocery waste through meal planning)
