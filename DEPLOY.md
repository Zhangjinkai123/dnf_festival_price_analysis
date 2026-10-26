# 🚀 线上部署手册(华为云 ECS + Caddy)

> 2026-10-26 上线。本文档记录部署形态、日常运维、加新项目与灾难恢复步骤。
> **安全约定:SSH 私钥与 sudo 密码不落盘、不入库**,本仓库的 `deploy/` 目录只含无敏感信息的配置与脚本。

---

## 一、线上信息

| 项 | 值 |
| :--- | :--- |
| 物价站地址 | `http://113.44.64.151/dnf/` |
| 项目导航页 | `http://113.44.64.151/` |
| 服务器 | 华为云 ECS `113.44.64.151`(Huawei Cloud EulerOS 2.0,登录用户 `jkz`,SSH 密钥登录) |
| Web 服务 | Caddy 2.11.4,systemd 服务 `caddy.service`,监听 80 端口 |
| 访问模式 | 公网 IP 访问自动**游客模式**(隐藏管理按钮);本地 `localhost`/`file://` 为管理员,详见 [README](README.md) 部署访问模式 |

## 二、服务器目录布局

| 路径 | 说明 | 仓库对应文件 |
| :--- | :--- | :--- |
| `/usr/local/bin/caddy` | Caddy 二进制 | (取自华为云 Debian 镜像 .deb,见第五节) |
| `/etc/caddy/Caddyfile` | 站点路由(子路径架构) | `deploy/Caddyfile` |
| `/etc/systemd/system/caddy.service` | systemd 单元 | `deploy/caddy.service` |
| `/var/www/dnf/` | 本项目发布目录(仅 index.html、compare.html、css/、js/、data/ 五样;归属 jkz,**更新免 sudo**) | 即仓库根目录去掉开发者文件 |
| `/var/www/html/index.html` | 项目导航页 | `deploy/navigation.html` |
| `~/apps/dnf-update.sh` | 一键更新脚本 | `deploy/dnf-update.sh` |
| `~/apps/start-caddy.sh` / `stop-caddy.sh` | 服务启停(sudoers 白名单免密) | `deploy/start-caddy.sh`、`deploy/stop-caddy.sh` |
| `~/apps/dnf-src/`、`repo.tar.gz` | 更新脚本的拉取缓存(可随时重建) | — |
| `/etc/sudoers.d/jkz-caddy` | jkz 对 `systemctl start/stop/restart/reload/status caddy` 的免密白名单(visudo 校验通过) | — |

架构要点:Caddy 以**专用系统用户 caddy**(无登录 shell)运行,80 端口由 systemd `AmbientCapabilities=CAP_NET_BIND_SERVICE` 授权;`/var/www` 归 jkz 所有,数据更新不触碰 root 权限。

## 三、日常更新流程(改完物价数据后)

1. **本地**:确认 `data/price_data.json` 与 `js/data.js` 双端同步(数据维护惯例),然后 `git push`
2. **服务器**:执行 `~/apps/dnf-update.sh`,自动完成"codeload 拉取 main 最新 → 解包校验 → 原子切换 `/var/www/dnf` → 本机自检"
3. 网页验证 `http://113.44.64.151/dnf/`(静态文件即改即生效,无需重启服务)

**回滚**:发布采用 `.new/.old` 目录原子切换;若新版异常,在旧版本被清理前可手动 `mv` 回退。历史数据回滚遵循 `backup/` 目录惯例。

## 四、加新项目(永远做加法,不动老地址)

1. 服务器 `mkdir /var/www/项目名` 放入静态文件(或照 dnf-update.sh 的模式写拉取脚本)
2. `/etc/caddy/Caddyfile` 增加一块:
   ```caddyfile
   handle_path /项目名/* {
       root * /var/www/项目名
       file_server
   }
   ```
   然后 `sudo systemctl reload caddy`
3. `/var/www/html/index.html` 导航页追加一张卡片

## 五、灾难恢复(服务器重装/迁移,约 10 分钟)

> 背景约束:该服务器访问 **GitHub release 二进制通道被掐**,**codeload 源码通道可用**;Caddy 二进制因此取自**华为云 Debian 镜像**的官方 .deb 免 root 解包(服务器有 `ar`/`tar`,无 dpkg)。

```bash
# 0. 本地把仓库的 deploy/ 目录传上去
scp -r deploy/ jkz@113.44.64.151:~/

# 1. Caddy 二进制(华为云 Debian 镜像官方 .deb)
mkdir -p ~/apps/caddy-pkg && cd ~/apps/caddy-pkg
curl -sL -O https://mirrors.huaweicloud.com/debian/pool/main/c/caddy/caddy_2.11.4-1_amd64.deb
ar x caddy_2.11.4-1_amd64.deb && mkdir x && tar -xJf data.tar.xz -C x
sudo mv x/usr/bin/caddy /usr/local/bin/caddy && sudo chmod +x /usr/local/bin/caddy
# 服务器若无 ar(binutils),替代方案:COPR 官方 RPM + rpm2cpio 解包(服务器有 rpm2cpio/cpio)

# 2. 用户与目录
sudo useradd --system -d /var/lib/caddy -s /sbin/nologin caddy
sudo mkdir -p /var/lib/caddy /etc/caddy /var/www
sudo chown -R caddy:caddy /var/lib/caddy && sudo chown jkz:jkz /var/www

# 3. 配置与站点
sudo cp ~/deploy/Caddyfile /etc/caddy/Caddyfile
sudo cp ~/deploy/caddy.service /etc/systemd/system/caddy.service
mkdir -p /var/www/html && cp ~/deploy/navigation.html /var/www/html/index.html
mkdir -p ~/apps && cp ~/deploy/dnf-update.sh ~/deploy/start-caddy.sh ~/deploy/stop-caddy.sh ~/apps/ && chmod +x ~/apps/*.sh

# 4. 首次发布站点文件(自动从 GitHub codeload 拉取)
~/apps/dnf-update.sh

# 5. 启动 + 开机自启
sudo systemctl daemon-reload && sudo systemctl enable --now caddy

# 6. (可选)服务管理免密白名单
echo 'jkz ALL=(root) NOPASSWD: /usr/bin/systemctl start caddy, /usr/bin/systemctl stop caddy, /usr/bin/systemctl restart caddy, /usr/bin/systemctl reload caddy, /usr/bin/systemctl status caddy' | sudo tee /etc/sudoers.d/jkz-caddy
sudo chmod 440 /etc/sudoers.d/jkz-caddy && sudo visudo -cf /etc/sudoers.d/jkz-caddy
```

最后:华为云控制台**安全组放行 TCP 80**(入方向,源 `0.0.0.0/0`)。

## 六、已知约束与经验教训

- **域名与备案**:华为云国内区域绑自定义域名必须 ICP 备案;备案后在 Caddyfile 增加域名站点块(替换/并存于 `:80`),Caddy 自动申请续期 HTTPS 证书。纯 IP 访问不需要备案,当前走此路线。
- **GitHub 访问**:release 资产下载通道不可用(0 字节停滞),`codeload.github.com` 源码通道正常——更新链路一律走 codeload,勿改回 release URL。
- **端口 80 与 root**:80 端口绑定需特权,由 systemd `AmbientCapabilities` 授权给 caddy 用户;更换 caddy 二进制后无需重设。
- **管理端口冲突坑**:同机若有残留 caddy 进程会占用其管理端口 `2019`,导致 systemd 服务启动失败(`bind: address already in use`)。启动失败先查:`ss -ltnp | grep 2019`。
- **Caddy 版本升级**:重复第五节第 1 步(取更高版本 .deb),`systemctl restart caddy` 即可,配置无需变动。
