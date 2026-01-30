#!/usr/bin/env bash
set -euo pipefail

# Ensure default dotfiles exist (first-time home volume init)
if [ ! -e "$HOME/.bashrc" ] && [ -d /etc/skel ]; then
  cp -an /etc/skel/. "$HOME/" || true
fi

# Persist bash history and append it safely across sessions
BASHRC="$HOME/.bashrc"

# Add once (idempotent)
if ! grep -q "BEGIN devcontainer bash-history" "$BASHRC" 2>/dev/null; then
  cat >> "$BASHRC" <<'EOF'

# BEGIN devcontainer bash-history
# write history after every command
PROMPT_COMMAND='history -a; history -n'
shopt -s histappend
HISTSIZE=10000
HISTFILESIZE=20000
# END devcontainer bash-history
EOF
fi

# Add a colorful prompt and ls colors (idempotent)
if ! grep -q "BEGIN devcontainer prompt-colors" "$BASHRC" 2>/dev/null; then
  cat >> "$BASHRC" <<'EOF'

# BEGIN devcontainer prompt-colors
if [[ $- == *i* ]]; then
  if command -v dircolors >/dev/null 2>&1; then
    eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias grep='grep --color=auto'
  fi

  if command -v tput >/dev/null 2>&1; then
    c_reset="$(tput sgr0)"
    c_user="$(tput setaf 10)"
    c_host="$(tput setaf 12)"
    c_path="$(tput setaf 6)"
    c_root="$(tput setaf 9)"
    if [ "$(id -u)" -eq 0 ]; then
      PS1="${c_root}\\u@\\h ${c_path}\\w${c_reset}# "
    else
      PS1="${c_user}\\u@\\h ${c_path}\\w${c_reset}$ "
    fi
  else
    if [ "$(id -u)" -eq 0 ]; then
      PS1='\[\e[31m\]\u@\h \[\e[36m\]\w\[\e[0m\]# '
    else
      PS1='\[\e[32m\]\u@\h \[\e[36m\]\w\[\e[0m\]$ '
    fi
  fi
fi
# END devcontainer prompt-colors
EOF
fi

# Enable bash completion + common aliases (idempotent)
if ! grep -q "BEGIN devcontainer bash-completion" "$BASHRC" 2>/dev/null; then
  cat >> "$BASHRC" <<'EOF'

# BEGIN devcontainer bash-completion
if [[ $- == *i* ]]; then
  if [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  elif [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  fi

  alias ll='ls -alF --color=auto'
  alias la='ls -A --color=auto'
  alias l='ls -CF --color=auto'
fi
# END devcontainer bash-completion
EOF
fi

npm i
