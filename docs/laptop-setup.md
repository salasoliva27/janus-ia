# Laptop Setup

These steps install Janus IA and Jano's private dotfiles on a laptop so the
Desktop launcher can run the same dashboard with the same tools and credentials.

The important contract is:

- Janus IA lives anywhere you clone it.
- Dotfiles live anywhere you clone them.
- Janus reads credentials from `~/.env`.
- Therefore, `~/.env` must point at or copy from `dotfiles/.env`.

## Windows

Install prerequisites first:

- Git for Windows
- Node.js LTS
- Python 3.11+
- uv or pipx, for Snowflake MCP

Open **Git Bash**, then run:

```bash
mkdir -p ~/code
cd ~/code

git clone https://github.com/salasoliva27/dotfiles.git
git clone https://github.com/salasoliva27/janus-ia.git

cp ~/code/dotfiles/.env ~/.env

cd ~/code/janus-ia
cmd.exe //c "Janus IA.cmd"
```

That launches Janus directly from the repo. To also create a Desktop shortcut,
run:

```bash
cmd.exe //c install-desktop.cmd
```

After that, double-click `Janus IA.cmd` on the Windows Desktop.

If you later update `dotfiles/.env`, copy it again:

```bash
cp ~/code/dotfiles/.env ~/.env
```

## macOS

Install prerequisites first:

- Git
- Node.js LTS
- Python 3.11+
- uv or pipx, for Snowflake MCP

Open Terminal, then run:

```bash
mkdir -p ~/code
cd ~/code

git clone https://github.com/salasoliva27/dotfiles.git
git clone https://github.com/salasoliva27/janus-ia.git

ln -sf ~/code/dotfiles/.env ~/.env

cd ~/code/janus-ia
./install-desktop.command
```

After that, double-click `Janus IA.command` on the Desktop.

## Linux

Install prerequisites first:

- Git
- Node.js LTS
- Python 3.11+
- uv or pipx, for Snowflake MCP

Then run:

```bash
mkdir -p ~/code
cd ~/code

git clone https://github.com/salasoliva27/dotfiles.git
git clone https://github.com/salasoliva27/janus-ia.git

ln -sf ~/code/dotfiles/.env ~/.env

cd ~/code/janus-ia
./scripts/install-launcher.sh
```

After that, double-click `janus-ia.desktop` on the Desktop.

## Verify

From inside the Janus repo:

```bash
test -f ~/.env && echo "home env present"
grep -q OPENAI_API_KEY ~/.env && echo "OpenAI key present"
./dash --open
```

Open `http://localhost:3100`. The top bar should let you switch engines and
models. The tools read the same credentials through `~/.env`.

## Notes

The private dotfiles repo may ask for GitHub authentication during clone. Use
the same GitHub account that owns `salasoliva27/dotfiles`.

Never commit `.env` into `janus-ia`. Keep secrets in the private dotfiles repo
and expose them locally through `~/.env`.
