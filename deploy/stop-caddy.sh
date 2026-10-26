#!/bin/bash
# 停止 Caddy 服务(安装到服务器 ~/apps/stop-caddy.sh;依赖 /etc/sudoers.d/jkz-caddy 免密白名单)
sudo systemctl stop caddy && echo "caddy 已停止"
