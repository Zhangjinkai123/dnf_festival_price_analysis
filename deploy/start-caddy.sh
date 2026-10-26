#!/bin/bash
# 启动 Caddy 服务(安装到服务器 ~/apps/start-caddy.sh;依赖 /etc/sudoers.d/jkz-caddy 免密白名单)
sudo systemctl start caddy && echo "caddy: $(systemctl is-active caddy)"
