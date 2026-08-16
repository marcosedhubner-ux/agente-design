# Ateliê Azul

A desktop AI mentor for graphic design, built as a native Windows app with Electron. It sits on your screen as a small floating button you can drag anywhere, and opens into a chat window when you need it.

I built this for my partner, who's studying graphic design and was just getting comfortable with computers. She wanted something she could show a project to and get quick, encouraging feedback from — not a generic chatbot tab buried in a browser, but an actual program on her desktop that felt like it belonged there.

## Why it's interesting

The main technical twist is that it doesn't call any paid API. Instead of wiring up the Anthropic API (which means a separate bill), the app shells out to the [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) already installed and logged in on the machine, using `claude -p` in non-interactive mode. That single decision shaped a lot of the architecture: prompts and responses go over stdin/stdout as JSON, conversations are resumed by session ID, and the whole thing works entirely on top of a Claude subscription the user already pays for.

Everything else grew from watching an actual non-technical user try the first version and asking "what would make this easier for her":

- **A screenshot tool with a countdown**, because taking a manual screenshot and finding the file was one step too many.
- **A screen-wide eyedropper** that freezes the display into an overlay and lets you sample any pixel, with a live magnifier loupe — not just the color of whatever happens to be inside the app window.
- **A color wheel with harmony groups and a swipeable "how to actually use this color" carousel** (as background, as text, paired with its complement, etc.), because "here's the complementary color" on its own isn't very actionable for a design student.
- **A manual background remover** (wand, lasso, and brush selection tools on a canvas) as a fallback for when the automatic, fully-local ONNX model doesn't do a clean job.
- **A clarifying-questions modal** that turns multi-question replies from the model into a small form instead of a wall of text ending in three question marks.
- **A floating widget** that's draggable, closable, and always finds its way back next to the chat window, because a tool that's supposed to live on your desktop shouldn't be easy to lose.

None of this was planned upfront — it's the result of iterating against real usage, one rough edge at a time.

## How it's built

- **Electron** for the desktop shell — a frameless, transparent main window styled entirely in the renderer to look like a rounded card rather than a native app window, plus a second always-on-top window for the floating widget.
- **The Claude Code CLI** as the actual "brain," invoked as a child process per message. No API key, no server, no network calls beyond what the CLI itself makes.
- **`sharp`** for local image processing (resizing before sending to the model to keep token usage down, plus a sharpen/contrast pass for a manual "enhance" tool).
- **`@imgly/background-removal-node`**, running an ONNX model in a separate worker process, for one-click local background removal — isolated from the main process because a native crash there would otherwise take the whole app down.
- Conversations, settings, and a small color history are persisted as JSON on disk (in the app's user data folder), so closing and reopening the app picks up where you left off.

## Getting started

You'll need:

- [Node.js](https://nodejs.org/) 18+
- The [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) installed and logged in (`claude` should work from a terminal on its own)

```bash
git clone <this-repo>
cd atelie-azul-app
npm install
cp .env.example .env   # only needed if `claude` isn't on your PATH
npm start
```

To build a standalone Windows executable:

```bash
npm run package:win
```

This produces `dist/Atelie Azul-win32-x64/Atelie Azul.exe`. It's packaged without `asar` on purpose — native modules (`sharp`, the ONNX runtime) can't be loaded from inside an `.asar` archive on Windows.

## Project structure

```
main.js                   Electron main process: windows, IPC, the Claude CLI bridge
preload.js                Context bridge for the main chat window
widget-preload.js         Context bridge for the floating widget
eyedropper-preload.js     Context bridge for the screen-color-picker overlay
bg-remove-worker.js       Background-removal, isolated in its own process
renderer/                 UI: chat window, floating widget, eyedropper overlay
assets/                   App icon and the mentor's persona/system prompt
```

The persona that shapes how the assistant behaves lives in `assets/claude-persona.md` — it's copied into the CLI's working directory as `CLAUDE.md` on every launch, so tweaking that one file changes the mentor's whole tone and behavior without touching any code.

## A note on the language

The UI and the mentor persona are in Brazilian Portuguese — that was the point, it's built for one specific person. Everything else (this README, the code) is in English.

## License

MIT — see [LICENSE](LICENSE).
