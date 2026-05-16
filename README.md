# 🔬 AI QA Evaluation Lab

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

> A professional-grade observability and evaluation platform for AI engineering. Test, trace, and gate your LLM applications with confidence.

AI QA Evaluation Lab is a comprehensive workspace designed to solve the "vibes-based" testing problem in AI development. It provides a structured environment to version prompts, manage test datasets, execute evaluation runs, and inspect detailed execution traces before shipping to production.

---

## ✨ Key Features

- **🚀 Run Executor**: Batch execute prompt/model variants against curated datasets with real-time progress tracking.
- **🕵️ Trace Viewer**: Step-by-step visibility into AI execution logic, including intermediate tool calls and hidden reasoning.
- **📊 Comparison Dashboard**: Side-by-side evaluation of baseline vs. candidate outputs to identify regressions instantly.
- **📝 Prompt Registry**: Version-controlled prompt management to ensure every output is linked to a specific prompt state.
- **📁 Dataset Manager**: Curate, tag, and version test cases for reproducible evaluation pipelines.
- **⚖️ Human-in-the-Loop Grading**: Manual review workflows integrated with automated scoring metrics (LLM-as-a-judge).
- **🛡️ Release Gating**: Data-backed decision making to mark prompt versions as "Production Ready" based on quality thresholds.

---

## 🛠️ Tech Stack

- **Frontend**: [Next.js 15](https://next.js) (App Router), [React 19](https://react.dev), [Tailwind CSS](https://tailwindcss.com), [Framer Motion](https://framer.com/motion)
- **Backend**: Next.js API Routes, [Prisma ORM](https://prisma.io)
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL + RLS)
- **State Management**: [TanStack Query v5](https://tanstack.com/query)
- **Visualization**: [Recharts](https://recharts.org)
- **Testing**: [Vitest](https://vitest.dev), [Playwright](https://playwright.dev)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A Supabase Project
- OpenAI / Anthropic / Gemini API Keys

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sreedevk78/AI-quality-testing-APP.git
   cd AI-quality-testing-APP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```

4. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 🏗️ Architecture

The application follows a modern full-stack architecture:

- `src/app`: Next.js pages and routing.
- `src/components`: Reusable UI components built with Tailwind and Radix.
- `src/lib`: Core utility functions and API clients.
- `src/server`: Backend logic, workers, and database operations.
- `prisma`: Database schema and migration history.
- `scripts`: Maintenance and utility scripts.

---

## 📋 Roadmap

- [ ] Multi-tenant Enterprise SSO
- [ ] Integration with LangSmith/LangFuse
- [ ] Custom Model Fine-tuning support
- [ ] Public Template Marketplace
- [ ] Real-time Collaboration in Trace Viewer

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

Developed with ❤️ for the AI Engineering community.
