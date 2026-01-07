# AI Studio

<h1 align="center">AI Studio: AI-Powered Real Estate Photo Editor</h1>

<p align="center">
  Transform property photos with AI. Upload images, select styles, and generate stunning real estate visuals instantly.
</p>

<p align="center">
  <img width="1200" alt="AI Studio dashboard" src="public/hero.png" />
</p>

<p align="center">
  <a href="https://github.com/codehagen/aistudio/blob/main/LICENSE.md">
    <img src="https://img.shields.io/github/license/codehagen/aistudio?label=license&logo=github&color=f80&logoColor=fff" alt="License" />
  </a>
</p>

<p align="center">
  <a href="#introduction"><strong>Introduction</strong></a> ·
  <a href="#key-features"><strong>Features</strong></a> ·
  <a href="#installation"><strong>Installation</strong></a> ·
  <a href="#tech-stack"><strong>Tech Stack</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#contributing"><strong>Contributing</strong></a>
</p>
<br/>

## Introduction

AI Studio is a cutting-edge real estate photo editing platform that leverages artificial intelligence to transform property photographs. Upload your real estate images, choose from professionally curated style templates, and let AI enhance your listings with stunning visuals that capture attention and drive more showings.

**Why AI Studio?**

- **AI-Powered Editing** – Transform ordinary property photos into professional marketing materials
- **Style Templates** – Curated collection of real estate photography styles (modern, luxury, cozy, etc.)
- **Instant Processing** – Generate enhanced images in seconds using Fal.ai
- **Team Collaboration** – Work together with your real estate team in shared workspaces
- **White-label Ready** – Custom branding options for agencies and brokerages

## Key Features

### AI Photo Enhancement

Upload property photos and apply AI-powered enhancements. Choose from professionally designed style templates that transform ordinary photos into marketing-ready visuals optimized for real estate listings.

### Style Templates

Curated collection of photography styles including:

- **Modern Minimalist** – Clean lines, contemporary appeal
- **Luxury Estate** – High-end, sophisticated presentation
- **Cozy Family Home** – Warm, inviting atmosphere
- **Urban Chic** – City lifestyle appeal

### Team Workspaces

Create collaborative workspaces for your real estate team:

- **Role-based Access** – Owner, admin, and member permissions
- **Shared Projects** – Work together on property listings
- **Team Invitations** – Invite members via email
- **Custom Branding** – White-label options for agencies

### Project Management

Organize your photo editing projects with:

- **Project Dashboard** – Grid and table views of all projects
- **Before/After Comparison** – Side-by-side image comparison
- **Status Tracking** – Monitor processing status and completion
- **Bulk Operations** – Edit multiple photos simultaneously

### Admin Panel

Comprehensive admin functionality for platform management:

- **User Management** – View and manage all users
- **Workspace Oversight** – Monitor team workspaces
- **Analytics Dashboard** – Track usage and performance metrics

## Installation

### Quick Start (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/codehagen/aistudio.git
cd aistudio

# 2. Install dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Set up the database
pnpm db:push

# 5. Set up Trigger.dev (Background Jobs)
# Get your TRIGGER_SECRET_KEY from https://cloud.trigger.dev
# Add it to .env.local as TRIGGER_SECRET_KEY=tr_dev_xxxxxxxxxx

# 6. Start development servers (run in separate terminals)
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: Trigger.dev dev server (for background jobs)
pnpm trigger
```

### Manual Setup

```bash
git clone https://github.com/codehagen/aistudio.git
cd aistudio
pnpm install
```

Copy the example environment file:

```bash
cp .env.example .env.local
```

Update `.env.local` with your credentials:

- `DATABASE_URL` – PostgreSQL connection string
- `FAL_API_KEY` – Fal.ai API key for AI image processing
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY` – Email delivery service

Push the database schema:

```bash
pnpm db:push
```

### Useful Commands

| Command            | Description                                        |
| ------------------ | -------------------------------------------------- |
| `pnpm dev`         | Start Next.js development server                   |
| `pnpm trigger`     | Start Trigger.dev development server (background jobs) |
| `pnpm build`       | Production build                                   |
| `pnpm start`       | Start production server                            |
| `pnpm lint`        | Run ESLint                                         |
| `pnpm db:push`     | Push schema changes to database                    |
| `pnpm db:generate` | Generate Drizzle migrations                        |
| `pnpm db:studio`   | Open Drizzle Studio                                |
| `pnpm email`       | Preview email templates                            |

> **Important**: For local development, you need to run both `pnpm dev` (Next.js) and `pnpm trigger` (Trigger.dev) in separate terminals. The Trigger.dev server handles background task processing.

## Tech Stack

### Core Framework

- **Next.js 16** – App Router, Server Actions, TypeScript
- **React 19** – Latest React with concurrent features
- **TypeScript 5** – Type-safe development

### Database & ORM

- **PostgreSQL** – Primary database
- **Drizzle ORM** – Type-safe database operations

### Authentication & Security

- **Better Auth** – Modern authentication with OAuth providers
- **Session Management** – Secure session handling

### AI & Image Processing

- **Fal.ai** – AI-powered image generation and editing
- **Custom Style Templates** – Curated prompts for real estate photography

### UI & Styling

- **Tailwind CSS v4** – Utility-first CSS framework
- **shadcn/ui** – High-quality React components
- **Radix UI** – Accessible component primitives
- **@tabler/icons-react** – Consistent icon library

### Development Tools

- **ESLint** – Code linting and formatting
- **Drizzle Kit** – Database migration and studio
- **React Email** – Email template development

### Platforms

- [Vercel](https://vercel.com/) – Deployment and preview environments
- [Supabase](https://supabase.com/) – PostgreSQL database and storage
- [Trigger.dev](https://trigger.dev/) – Background jobs and task scheduling
- [Resend](https://resend.com/) – Email delivery infrastructure

## Architecture

AI Studio follows a modern web application architecture:

```
┌─────────────────┐     ┌──────────────────┐
│    Fal.ai API   │────▶│   ImageGeneration │
│ (AI Processing) │     │   Style Templates │
└─────────────────┘     └────────┬─────────┘
                                 │
                                 ▼
┌─────────────────┐     ┌──────────────────┐
│   Better Auth   │────▶│   User Session    │
│ (Authentication)│     │   Workspace       │
└─────────────────┘     │   Team Members    │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │   Dashboard       │
                        │   Projects        │
                        │   Admin Panel     │
                        └──────────────────┘
```

### Key Directories

```
app/
├── dashboard/          # Main project dashboard
│   ├── page.tsx        # Projects grid with view toggle
│   ├── layout.tsx      # Dashboard layout with header
│   ├── settings/       # Workspace & team settings
│   └── [id]/           # Individual project detail
├── admin/              # Admin panel
│   ├── users/          # User management
│   ├── workspaces/     # Workspace oversight
│   └── layout.tsx      # Admin layout
├── api/
│   ├── auth/           # Better Auth endpoints
│   └── edit-photo/     # Fal.ai image processing
lib/
├── db/
│   ├── schema.ts       # Drizzle database schema
│   └── index.ts        # Database client
├── mock/               # Mock data for development
├── style-templates.ts  # AI style templates
├── auth.ts             # Better Auth configuration
└── siteconfig.ts       # Site configuration
components/
├── ui/                 # shadcn/ui base components
├── dashboard/          # Dashboard-specific components
├── projects/           # Project creation workflow
├── settings/           # Settings page components
├── admin/              # Admin panel components
└── tables/             # Data tables with virtual scrolling
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/aistudio

# AI Processing
FAL_API_KEY=your_fal_api_key_here

# Authentication
BETTER_AUTH_SECRET=your_secret_key
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email
RESEND_API_KEY=your_resend_api_key

# Trigger.dev (Background Jobs)
TRIGGER_SECRET_KEY=tr_dev_xxxxxxxxxx
```

> **Note**: For local development with Trigger.dev, you need to:
> 1. Get your DEV secret key from the [API Keys page](https://cloud.trigger.dev) in your Trigger.dev project dashboard
> 2. Add it to your `.env.local` file as `TRIGGER_SECRET_KEY`
> 3. Run `pnpm trigger` in a separate terminal to start the Trigger.dev development server

## Contributing

We love our contributors! Here's how you can contribute:

- [Open an issue](https://github.com/codehagen/aistudio/issues) if you believe you've encountered a bug.
- Make a [pull request](https://github.com/codehagen/aistudio/pull) to add new features/make quality-of-life improvements/fix bugs.

<a href="https://github.com/codehagen/aistudio/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=codehagen/aistudio" />
</a>

## Repo Activity

![AI Studio repo activity – generated by Axiom](https://repobeats.axiom.co/api/embed/b221e29ccd5f3c11ba61d115b24e6924b6a4724f.svg "Repobeats analytics image")

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE.md](LICENSE.md) file for details.

---

Built for real estate professionals who want to showcase properties in their best light.
