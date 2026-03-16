# tut - 锚点移动检测与轨迹录制应用

一个用于检测锚点移动、绘制轨迹并录制视频的Web应用，可以添加到iPhone主屏幕使用。

## 📱 功能特点

- ✅ 调用iPhone相机实时预览
- ✅ 点击屏幕设置锚点
- ✅ 实时检测锚点位置移动
- ✅ 自动绘制移动轨迹
- ✅ 移动时自动开始计时
- ✅ 视频录制功能
- ✅ 可保存视频到相册
- ✅ 可添加到iPhone主屏幕
- ✅ 支持自定义设置（灵敏度、颜色等）

## 🚀 快速开始

### 第一步：生成应用图标

1. 在电脑上打开 `tut-app/icons/generate_icons.html` 文件
2. 点击"下载192x192图标"按钮
3. 点击"下载512x512图标"按钮
4. 将下载的两个文件重命名为：
   - `icon-192.png`
   - `icon-512.png`
5. 将这两个文件移动到 `tut-app/icons/` 目录

### 第二步：注册GitHub

1. 访问 https://github.com
2. 点击"Sign up"注册账号
3. 验证邮箱

### 第三步：创建仓库

1. 登录GitHub后，点击右上角"+"，选择"New repository"
2. 仓库名称输入：`tut-app`
3. 选择"Public"（公开仓库）
4. 勾选"Initialize this repository with a README"
5. 点击"Create repository"

### 第四步：上传代码

**方法A：GitHub网页界面上传（推荐，最简单）**

1. 进入刚创建的仓库
2. 点击"Add file" > "Upload files"
3. 将 `tut-app` 文件夹内的所有文件拖拽到上传区域：
   - `index.html`
   - `app.js`
   - `manifest.json`
   - `icons/icon-192.png`
   - `icons/icon-512.png`
   - `README.md`（这个文件）
4. 在"Commit changes"输入框填写：`Initial commit`
5. 点击"Commit changes"按钮

**方法B：使用Git命令行（如果熟悉Git）**

```bash
cd C:\Users\xyc\Desktop\tut-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/tut-app.git
git branch -M main
git push -u origin main
```

### 第五步：启用GitHub Pages

1. 在仓库页面，点击"Settings"标签
2. 在左侧菜单找到"Pages"
3. 在"Build and deployment"部分：
   - "Source"选择：`Deploy from a branch`
   - "Branch"选择：`main`
   - 文件夹选择：`/ (root)`
4. 点击"Save"按钮

### 第六步：获取应用地址

等待1-2分钟后，刷新"Pages"设置页面，你会看到：

```
Your site is live at https://你的用户名.github.io/tut-app
```

这个URL就是你的应用地址！

### 第七步：iPhone安装

1. 打开iPhone上的Safari浏览器
2. 访问上面的应用地址
3. 测试功能是否正常
4. 点击底部分享按钮（□↑）
5. 选择"添加到主屏幕"
6. 确认名称"tut"
7. 点击"添加"

## 📖 使用说明

### 基本操作

1. **设置锚点**
   - 在相机画面中点击任意位置
   - 出现红色圆圈表示锚点已设置

2. **开始录制**
   - 点击"开始录制"按钮
   - 当锚点位置发生移动时，自动开始计时并绘制轨迹

3. **停止录制**
   - 再次点击"停止录制"按钮
   - 视频会自动停止录制

4. **查看视频**
   - 录制结束后会显示视频预览
   - 可以回放查看轨迹效果
   - 点击"保存视频"下载视频文件

5. **清除锚点**
   - 点击"清除锚点"按钮清除当前锚点
   - 可以重新设置新的锚点

### 高级设置

点击"设置"按钮可以自定义：

- **移动检测灵敏度**：1-100，数值越大越敏感
- **检测区域大小**：锚点周围检测范围
- **轨迹颜色**：红色、绿色、蓝色、橙色
- **轨迹宽度**：轨迹线条粗细

## 🔧 技术细节

- **前端框架**：纯HTML5 + CSS3 + JavaScript
- **PWA支持**：可添加到主屏幕
- **相机调用**：MediaDevices API
- **视频录制**：MediaRecorder API
- **轨迹绘制**：Canvas API
- **移动检测**：像素对比算法

## 💡 使用技巧

1. **设置锚点**
   - 选择对比度明显的区域作为锚点
   - 避免选择纯色或过于复杂的背景
   - 锚点应该包含多个特征点

2. **调整灵敏度**
   - 环境光线变化大时降低灵敏度
   - 需要检测微小移动时提高灵敏度
   - 建议先测试不同环境下的最佳值

3. **录制视频**
   - 录制时保持手机稳定
   - 确保光线充足
   - 避免快速晃动镜头

## 🌐 部署到GitHub Pages详细步骤

### 1. 准备工作

- 确保已注册GitHub账号
- 确保已生成应用图标文件

### 2. 上传文件

上传以下文件到GitHub仓库：

```
tut-app/
├── index.html          # 主页面
├── app.js              # 核心逻辑
├── manifest.json       # PWA配置
├── icons/
│   ├── icon-192.png    # 应用图标 192x192
│   └── icon-512.png    # 应用图标 512x512
└── README.md           # 使用说明
```

### 3. 启用Pages

在仓库设置中：

1. Settings → Pages
2. Source选择：Deploy from a branch
3. Branch选择：main → /(root)
4. 点击Save

### 4. 等待部署

GitHub Pages会在1-2分钟内完成部署，然后你就能通过以下地址访问：

`https://你的用户名.github.io/tut-app`

### 5. 更新应用

如果需要修改代码：

1. 在本地修改文件
2. 测试功能（可用本地服务器：`python -m http.server 8000`）
3. 重新上传到GitHub
4. 等待GitHub Pages自动部署
5. iPhone刷新页面即可看到更新

## 📱 iPhone使用注意事项

1. **权限要求**
   - 首次使用需要授权相机权限
   - 在Safari中访问时允许相机访问

2. **网络要求**
   - 首次安装需要网络连接
   - 使用时建议保持网络连接
   - 如需离线使用，可以后续添加Service Worker

3. **系统限制**
   - iOS Safari对视频录制有限制
   - 视频格式为WebM，部分播放器可能不支持
   - 无法直接保存到相册，需要手动下载

## 🐛 常见问题

**Q: 为什么看不到视频？**
A: 确保已授权相机权限，刷新页面重试。

**Q: 录制的视频无法播放？**
A: iOS对WebM支持有限，尝试在电脑上播放，或使用支持WebM的播放器。

**Q: 如何更新应用？**
A: 修改代码后重新上传到GitHub，等待自动部署，刷新页面即可。

**Q: 应用可以离线使用吗？**
A: 当前版本需要网络，可以通过添加Service Worker实现离线功能。

## 🔄 更新应用流程

1. 在Windows上修改代码
2. 本地测试：打开 `tut-app/icons/generate_icons.html` 旁边的命令行，运行：
   ```bash
   python -m http.server 8000
   ```
3. 在浏览器访问 `http://localhost:8000` 测试
4. 测试通过后，重新上传到GitHub
5. 等待GitHub Pages自动部署
6. iPhone刷新页面或重新打开

## 📄 许可证

MIT License - 可自由使用和修改

## 👨‍💻 开发者

- 开发环境：Windows 11
- 测试设备：iPhone 14 Plus
- 部署平台：GitHub Pages

## 🙏 致谢

感谢使用tut应用！如有问题或建议，欢迎反馈。
