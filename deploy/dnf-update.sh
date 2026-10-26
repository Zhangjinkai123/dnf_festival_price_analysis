#!/bin/bash
# 一键更新(安装到服务器 ~/apps/dnf-update.sh):本地 git push 后在服务器执行本脚本
# 流程:codeload 拉取 main 最新源码 → 解包 → 原子发布到 /var/www/dnf → 本机自检
# 说明:服务器访问 GitHub release 通道不稳,codeload 源码通道可用;发布目录归属 jkz,全程无需 sudo
set -e
cd "$HOME/apps"
echo "[1/3] 从 GitHub 拉取最新源码..."
curl -sL --max-time 120 -o repo.tar.gz 'https://codeload.github.com/Zhangjinkai123/dnf_festival_price_analysis/tar.gz/refs/heads/main'
rm -rf dnf-src && mkdir dnf-src
tar -xzf repo.tar.gz -C dnf-src --strip-components=1
echo "[2/3] 原子发布到 /var/www..."
rm -rf /var/www/dnf.new && mkdir /var/www/dnf.new
cp -r dnf-src/index.html dnf-src/compare.html dnf-src/css dnf-src/js dnf-src/data /var/www/dnf.new/
rm -rf /var/www/dnf.old
[ -d /var/www/dnf ] && mv /var/www/dnf /var/www/dnf.old || true
mv /var/www/dnf.new /var/www/dnf
rm -rf /var/www/dnf.old
echo "[3/3] 自检..."
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' http://127.0.0.1:80/dnf/ || echo "注意: 服务未运行,执行 ~/apps/start-caddy.sh"
echo "更新完成: $(date '+%F %T')"
