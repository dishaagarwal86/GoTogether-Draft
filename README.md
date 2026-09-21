# GoTogether

Group setup guide for the GoTogether React and TypeScript project.

## What This Project Uses

- React 19
- TypeScript
- Vite
- Oxlint
- npm

## 1. Install Prerequisites on macOS

Install Node.js and npm on your Mac. The current project was created and tested with Node.js `24.7.0` and npm `11.5.1`.

The simplest option is to install Node.js from [nodejs.org](https://nodejs.org/). After installation, open a new Terminal window and verify it:

```bash
node --version
npm --version
```

Node.js 24 or newer is recommended for this project.

## 2. Install Git

Check whether Git is already installed:

```bash
git --version
```

If macOS asks to install the Xcode Command Line Tools, accept the prompt and wait for installation to finish.

## 3. Download the Project

Clone the repository using the project URL supplied by the group. Replace the placeholder URL with the real repository URL:

```bash
git clone <REPOSITORY_URL>
cd GoTogether-Draft
```

If the repository was downloaded as a ZIP file instead, extract it, open Terminal, and move into the extracted folder:

```bash
cd /path/to/GoTogether-Draft
```

## 4. Install Project Dependencies

Run this from the project root, the folder containing `package.json`:

```bash
npm install
```

This reads `package.json`, installs the required packages into `node_modules`, and uses `package-lock.json` to keep everyone on consistent dependency versions. Do not commit `node_modules` because it is already excluded by `.gitignore`.

## 5. Start the Development Server

```bash
npm run dev
```

Open the local URL printed in Terminal, normally:

```text
http://localhost:5173/
```

Keep the Terminal window running while developing. Vite automatically reloads the browser when source files change. Stop the server with `Control-C`.

## 6. Check Changes Before Sharing Them

Run the linter:

```bash
npm run lint
```

Run the production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

All three commands should pass before opening a pull request or sharing changes with the group.

## Project Structure

```text
GoTogether-Draft/
├── public/              Static files copied directly to the build
├── src/
│   ├── components/      Reusable UI pieces and the master app shell
│   ├── data/            Shared trip and itinerary data
│   ├── pages/            Route-level page containers
│   ├── App.tsx          Application entry and router setup
│   ├── App.css          Application component styles
│   └── index.css        Global reset and font styles
├── .gitignore           Files excluded from Git
├── .oxlintrc.json       Linter configuration
├── index.html           Application HTML entry point
├── package.json         Dependencies and npm scripts
├── package-lock.json    Locked dependency versions
├── tsconfig.json        TypeScript project configuration
├── vite.config.ts       Vite configuration
└── README.md            This setup guide
```

### Where to Add New Code

- Add reusable UI to `src/components/`.
- Add full route screens to `src/pages/`.
- Add shared content or API-ready mock data to `src/data/`.
- Keep markup and behavior in `.tsx` files and styling in `.css` files. Avoid putting large page implementations back into `App.tsx`.

### Trip Planning Routes

The current trip-room flow is connected with client-side navigation:

| Route | Screen |
| --- | --- |
| `/` | Dashboard home |
| `/plan` | Choose an existing room or create a new one |
| `/room/new` | Enter a room name and invite email |
| `/room/questions` | Choose group travel preferences |
| `/room/overview` | View the created room and submitted preferences |
| `/trips` | Planned trips |
| `/inspiration` | Destination inspiration |

## Available npm Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Check code with Oxlint |
| `npm run build` | Type-check and create the production build |
| `npm run preview` | Preview the production build locally |

## Group Git Workflow

Before starting work:

```bash
git pull
```

Create a branch for each feature or fix:

```bash
git switch -c feature/short-description
```

After making changes:

```bash
npm run lint
npm run build
git status
git add .
git commit -m "Describe the change"
git push -u origin feature/short-description
```

Open a pull request and have another group member review it before merging. Avoid committing generated folders such as `node_modules` and `dist`.

## Troubleshooting

### `npm: command not found`

Node.js is not installed correctly or the Terminal has not picked up the installation. Install Node.js, close and reopen Terminal, then run `node --version` again.

### Dependencies seem broken

From the project root, reinstall them:

```bash
rm -rf node_modules
npm install
```

### Port 5173 is already in use

Run `npm run dev` anyway. Vite will offer another available local port in the Terminal output.

### TypeScript or lint errors

Read the file and line reported in the error. Fix the source code, then rerun:

```bash
npm run lint
npm run build
```
