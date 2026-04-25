#!/bin/sh
# Atlas container entrypoint — bootstraps SSH host keys + replica dirs, then
# hands off to uvicorn (PID 1). Atlas's Python code spawns sshd + litestream
# as child processes when HA is enabled.
set -eu

# Persistent SSH host keys (volume-backed so they survive container recreation)
mkdir -p /data/ssh-host-keys
[ -f /data/ssh-host-keys/ssh_host_ed25519_key ] || \
    ssh-keygen -t ed25519 -f /data/ssh-host-keys/ssh_host_ed25519_key -N "" -q
[ -f /data/ssh-host-keys/ssh_host_rsa_key ] || \
    ssh-keygen -t rsa -b 4096 -f /data/ssh-host-keys/ssh_host_rsa_key -N "" -q
chmod 600 /data/ssh-host-keys/ssh_host_*_key

# Replica inbound layout. The chroot root + all its ancestors must be
# root-owned (sshd enforces this strictly). /srv/replica-inbound is set up
# in the Dockerfile; we just ensure the per-letter subdirs exist and are
# atlas-owned so internal-sftp can write into them.
mkdir -p /srv/replica-inbound/A /srv/replica-inbound/B
chown root:root /srv /srv/replica-inbound
chmod 755 /srv /srv/replica-inbound
chown atlas:atlas /srv/replica-inbound/A /srv/replica-inbound/B
chmod 755 /srv/replica-inbound/A /srv/replica-inbound/B

# Authorized peer pubkeys — managed by app/ha.py; sshd reads at connect time.
touch /data/atlas-authorized_keys
chown atlas:atlas /data/atlas-authorized_keys
chmod 600 /data/atlas-authorized_keys

# /run for sshd pid + sshd needs /run/sshd to exist
mkdir -p /run/sshd

exec "$@"
