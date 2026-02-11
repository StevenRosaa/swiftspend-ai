# SwiftSpend AI 💸

An intelligent bank statement analyzer that transforms messy PDF documents into clear, categorized financial insights using **Gemini 2.0 Flash**.

## 🚀 Features
- **Smart Categorization**: Automatically groups transactions into categories like Groceries, Dining, and Transport.
- **Robust PDF Parsing**: Handles multi-page bank statements from various Italian banks.
- **Interactive Dashboard**: Visualize your spending patterns with dynamic charts.
- **Data Export**: Export your processed transactions to CSV for further accounting.

## 🛠️ Tech Stack
- **Frontend**: Next.js, TypeScript, Tailwind CSS, Recharts, Lucide React.
- **Backend**: FastAPI (Python), Google Gemini AI API, PDFPlumber.
- **DevOps**: Git, Uvicorn.

## ⚙️ Setup & Installation

### Backend
1. Create a virtual environment: `python -m venv venv`
2. Activate it: `.\venv\Scripts\activate` (Windows)
3. Install dependencies: `pip install fastapi uvicorn google-genai python-dotenv pdfplumber tqdm`
4. Create a `.env.local` file and add your `GEMINI_API_KEY`.
5. Run: `python -m uvicorn api.index:app --reload`

### Frontend
1. Install dependencies: `npm install`
2. Run the development server: `npm run dev`

## 🛡️ Privacy
SwiftSpend AI processes data locally or via the Gemini API. No financial data is stored permanently on our servers.