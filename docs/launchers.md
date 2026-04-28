# Launching Janus IA

Janus is still one dashboard. The launchers only start the existing `./dash`
entry point with `JANUS_OPEN_BROWSER=1`, so model engines, MCP tools, and
credentials keep flowing through the same dotfiles-backed runtime.

## Desktop

From the computer where you want the Desktop icon, clone or download this repo
and run the installer for that operating system:

- Windows: double-click `install-desktop.cmd`
- macOS: double-click `install-desktop.command`
- Linux: run `./scripts/install-launcher.sh`

That creates one of these, depending on the machine:

- Windows: `Janus IA.cmd` on the Desktop
- macOS: `Janus IA.command` on the Desktop
- Linux: `janus-ia.desktop` on the Desktop

Double-clicking it starts the bridge, builds the frontend when needed, loads
credentials from `~/.env`, and opens `http://localhost:3100`.

The installer must run on the target machine. Running it in Codespaces only
creates a launcher inside Codespaces, not on your laptop.

For first-time laptop setup with the private dotfiles repo, follow
`docs/laptop-setup.md` before using the launcher.

## Samsung Phone

No app store package is needed. Janus is PWA-ready through
`manifest.webmanifest`, icons, and the service worker.

For a Samsung phone, open the dashboard URL in Chrome or Samsung Internet, then
use the browser menu's install/add-to-home-screen action. The phone must reach
the dashboard over a secure URL for full PWA install behavior. Use the Oracle
deployment, a Codespaces forwarded HTTPS URL, Tailscale Serve, or another HTTPS
reverse proxy rather than plain `http://localhost:3100`.

If you are only on the same Wi-Fi with a LAN IP, the browser may still create a
home-screen bookmark, but it may not install as a standalone app unless the URL
is HTTPS.
