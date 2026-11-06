# veFaaS 原生 Node 20 部署

现有应用 `wemo`（`2d7c81366467`）的底层函数为 `1cnmfcuf`，运行环境是 Linux x64、Node 20、Debian 11 / glibc 2.31。Dockerfile 是另一条容器部署路径，不用于当前原生运行时。

## 构建

Windows 开发机通过 WSL Ubuntu 运行匹配云端系统库的隔离构建。需要 WSL、sudo 和 debootstrap；首次构建会下载 Debian 11 构建环境与已校验 SHA-256 的 Node 20.20.0。

```powershell
wsl -d Ubuntu -- bash scripts/build-vefaas-bullseye.sh
node scripts/verify-vefaas-artifact.mjs
```

产物位于 `.vefaas/linux-standalone`，不会提交 Git。构建不复制 `.env*`、本地数据库或图片数据，运行时配置保留在 veFaaS。构建脚本验证 SQLite 与 sharp 能加载；打包验证拒绝 Windows 原生模块、未实体化链接和环境变量文件。

不要在 Windows 或更新 glibc 的 Ubuntu 上直接构建生产原生依赖。`better-sqlite3` 与 Node ABI、操作系统及系统库有关，仅成功生成 Next.js 页面不能证明数据库可用。

## 发布现有应用

确认现有数据快照已经上传，发布期间停止业务写入，再运行：

```powershell
vefaas config list
vefaas deploy --appId 2d7c81366467 --buildCommand "node scripts/verify-vefaas-artifact.mjs" --outputPath ".vefaas/linux-standalone" --command "node server.js" --port 3000 --yes
vefaas fn release-record status --id 1cnmfcuf --region cn-beijing -o json
```

若客户端提示正在发布，不要连续重发；查询发布记录，等待当前事务完成。以稳定版本、100% 流量、实例就绪与真实业务请求共同验收，不能仅看应用列表的汇总状态或首页。

## 不配置常驻实例时的持久化

当前按用户选择使用 `min=0,max=1`。受保护 API 在存储请求上下文内等待 `flushSqliteBackup()` 完成后才返回；后台备份定时器只作补偿。备份失败会将请求报告为错误，客户端重试写操作应考虑幂等性。

发布后需验证登录、衣柜读写、图片读取、不同用户隔离以及新实例从 TOS 固定快照恢复。模型 API Key 的认证、模型权限和余额是独立的验收项；有密钥字段不代表对应 AI 功能可用。
