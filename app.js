// tut应用主逻辑

class TutApp {
    constructor() {
        // DOM元素
        this.videoElement = document.getElementById('videoElement');
        this.trajectoryCanvas = document.getElementById('trajectoryCanvas');
        this.anchorPoint = document.getElementById('anchorPoint');
        this.anchorStatus = document.getElementById('anchorStatus');
        this.timerDisplay = document.getElementById('timer');
        this.movementIndicator = document.getElementById('movementIndicator');
        this.loading = document.getElementById('loading');
        this.permissionRequest = document.getElementById('permissionRequest');

        this.cameraContainer = document.querySelector('.camera-container');
        this.recordBtn = document.getElementById('recordBtn');
        this.clearAnchorBtn = document.getElementById('clearAnchorBtn');
        this.settingsBtn = document.getElementById('settingsBtn');

        // 设置相关元素
        this.settingsPanel = document.getElementById('settingsPanel');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.areaSlider = document.getElementById('areaSlider');
        this.areaValue = document.getElementById('areaValue');
        this.colorSelect = document.getElementById('colorSelect');
        this.lineWidthSlider = document.getElementById('lineWidthSlider');
        this.lineWidthValue = document.getElementById('lineWidthValue');

        // 视频预览相关元素
        this.videoPreview = document.getElementById('videoPreview');
        this.previewVideo = document.getElementById('previewVideo');
        this.closePreviewBtn = document.getElementById('closePreviewBtn');
        this.saveVideoBtn = document.getElementById('saveVideoBtn');

        // 状态变量
        this.stream = null;
        this.anchorX = null;
        this.anchorY = null;
        this.isRecording = false;
        this.hasMovement = false;
        this.recordingStartTime = null;
        this.trajectoryPoints = [];
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.timerInterval = null;
        this.animationFrame = null;
        this.canvasCtx = this.trajectoryCanvas.getContext('2d');

        // 设置参数
        this.settings = {
            sensitivity: 30,  // 移动检测灵敏度 (1-100)
            areaSize: 20,     // 检测区域大小 (5-50)
            color: '#ff3b30', // 轨迹颜色
            lineWidth: 3      // 轨迹宽度
        };

        // 隐藏的canvas用于移动检测
        this.detectionCanvas = document.createElement('canvas');
        this.detectionCtx = this.detectionCanvas.getContext('2d');
        this.initialImageData = null;

        this.init();
    }

    async init() {
        try {
            // 尝试访问相机
            await this.requestCameraPermission();
        } catch (error) {
            console.error('相机初始化失败:', error);
            this.showPermissionRequest();
        }

        // 绑定事件
        this.bindEvents();

        // 调整canvas大小
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    async requestCameraPermission() {
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.videoElement.srcObject = this.stream;

        // 等待视频加载
        await new Promise((resolve) => {
            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play();
                resolve();
            };
        });

        // 隐藏加载提示
        this.loading.style.display = 'none';

        // 初始化检测canvas大小
        this.detectionCanvas.width = 320; // 使用较小尺寸提高性能
        this.detectionCanvas.height = 240;
    }

    showPermissionRequest() {
        this.loading.style.display = 'none';
        this.permissionRequest.classList.add('active');

        document.getElementById('grantPermissionBtn').addEventListener('click', async () => {
            try {
                await this.requestCameraPermission();
                this.permissionRequest.classList.remove('active');
            } catch (error) {
                alert('无法访问相机，请确保已授权相机权限。');
            }
        });
    }

    bindEvents() {
        // 相机容器点击 - 设置锚点
        this.cameraContainer.addEventListener('click', (e) => this.handleContainerClick(e));

        // 控制按钮
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.clearAnchorBtn.addEventListener('click', () => this.clearAnchor());
        this.settingsBtn.addEventListener('click', () => this.openSettings());

        // 设置面板
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());

        // 设置滑块
        this.sensitivitySlider.addEventListener('input', (e) => {
            this.settings.sensitivity = parseInt(e.target.value);
            this.sensitivityValue.textContent = e.target.value;
        });

        this.areaSlider.addEventListener('input', (e) => {
            this.settings.areaSize = parseInt(e.target.value);
            this.areaValue.textContent = e.target.value;
        });

        this.colorSelect.addEventListener('change', (e) => {
            this.settings.color = e.target.value;
            // 更新锚点颜色
            this.anchorPoint.style.borderColor = this.settings.color;
            this.anchorPoint.style.background = this.settings.color + '33'; // 20% opacity
        });

        this.lineWidthSlider.addEventListener('input', (e) => {
            this.settings.lineWidth = parseInt(e.target.value);
            this.lineWidthValue.textContent = e.target.value;
        });

        // 视频预览
        this.closePreviewBtn.addEventListener('click', () => this.closeVideoPreview());
        this.saveVideoBtn.addEventListener('click', () => this.saveVideo());
    }

    handleContainerClick(e) {
        if (this.isRecording) return;

        // 获取点击位置
        const rect = this.cameraContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 转换到视频坐标系
        const videoRect = this.videoElement.getBoundingClientRect();
        const scaleX = this.videoElement.videoWidth / videoRect.width;
        const scaleY = this.videoElement.videoHeight / videoRect.height;

        // 考虑视频被翻转
        const actualX = (videoRect.width - x) * scaleX;
        const actualY = y * scaleY;

        // 保存锚点坐标
        this.anchorX = actualX;
        this.anchorY = actualY;

        // 更新UI
        const anchorStyleX = x;
        const anchorStyleY = y;
        this.anchorPoint.style.left = `${anchorStyleX}px`;
        this.anchorPoint.style.top = `${anchorStyleY}px`;
        this.anchorPoint.style.display = 'block';

        // 更新状态
        this.anchorStatus.textContent = '锚点已设置，可开始录制';
        this.anchorStatus.classList.add('active');
        this.clearAnchorBtn.disabled = false;

        // 保存初始图像数据用于移动检测
        this.saveInitialImageData();
    }

    saveInitialImageData() {
        if (!this.stream || !this.videoElement.videoWidth) return;

        // 绘制当前帧到检测canvas
        const scaleX = this.detectionCanvas.width / this.videoElement.videoWidth;
        const scaleY = this.detectionCanvas.height / this.videoElement.videoHeight;

        this.detectionCtx.drawImage(
            this.videoElement,
            0, 0,
            this.detectionCanvas.width,
            this.detectionCanvas.height
        );

        // 获取锚点区域的图像数据
        const scaledAnchorX = Math.floor(this.anchorX * scaleX);
        const scaledAnchorY = Math.floor(this.anchorY * scaleY);
        const areaSize = this.settings.areaSize;

        const imageData = this.detectionCtx.getImageData(
            scaledAnchorX - areaSize,
            scaledAnchorY - areaSize,
            areaSize * 2,
            areaSize * 2
        );

        this.initialImageData = imageData;
    }

    checkMovement() {
        if (!this.initialImageData || !this.stream) return false;

        // 绘制当前帧
        const scaleX = this.detectionCanvas.width / this.videoElement.videoWidth;
        const scaleY = this.detectionCanvas.height / this.videoElement.videoHeight;

        this.detectionCtx.drawImage(
            this.videoElement,
            0, 0,
            this.detectionCanvas.width,
            this.detectionCanvas.height
        );

        // 获取当前帧的锚点区域
        const scaledAnchorX = Math.floor(this.anchorX * scaleX);
        const scaledAnchorY = Math.floor(this.anchorY * scaleY);
        const areaSize = this.settings.areaSize;

        const currentImageData = this.detectionCtx.getImageData(
            scaledAnchorX - areaSize,
            scaledAnchorY - areaSize,
            areaSize * 2,
            areaSize * 2
        );

        // 计算像素差异
        let totalDifference = 0;
        const threshold = 30; // 单个像素的阈值
        const sensitivity = this.settings.sensitivity; // 1-100，越大越敏感

        for (let i = 0; i < this.initialImageData.data.length; i += 4) {
            const rDiff = Math.abs(currentImageData.data[i] - this.initialImageData.data[i]);
            const gDiff = Math.abs(currentImageData.data[i + 1] - this.initialImageData.data[i + 1]);
            const bDiff = Math.abs(currentImageData.data[i + 2] - this.initialImageData.data[i + 2]);

            const avgDiff = (rDiff + gDiff + bDiff) / 3;

            if (avgDiff > threshold) {
                totalDifference++;
            }
        }

        // 计算变化比例
        const totalPixels = this.initialImageData.data.length / 4;
        const changeRatio = (totalDifference / totalPixels) * 100;

        // 根据灵敏度判断是否移动
        return changeRatio > (100 - sensitivity) * 0.1;
    }

    toggleRecording() {
        if (!this.anchorX || !this.anchorY) {
            alert('请先点击屏幕设置锚点！');
            return;
        }

        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        this.isRecording = true;
        this.hasMovement = false;
        this.recordingStartTime = null;
        this.trajectoryPoints = [];
        this.recordedChunks = [];

        // 更新UI
        this.recordBtn.textContent = '停止录制';
        this.recordBtn.classList.remove('btn-primary');
        this.recordBtn.classList.add('btn-danger');
        this.anchorStatus.textContent = '录制中...';

        // 清空轨迹canvas
        this.canvasCtx.clearRect(0, 0, this.trajectoryCanvas.width, this.trajectoryCanvas.height);

        // 开始录制视频
        const canvasStream = this.trajectoryCanvas.captureStream(30);
        this.mediaRecorder = new MediaRecorder(canvasStream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.showVideoPreview();
        };

        this.mediaRecorder.start();

        // 开始检测和绘制循环
        this.detectionLoop();
    }

    stopRecording() {
        this.isRecording = false;

        // 停止视频录制
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // 停止计时器
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        // 停止动画循环
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // 更新UI
        this.recordBtn.textContent = '开始录制';
        this.recordBtn.classList.remove('btn-danger');
        this.recordBtn.classList.add('btn-primary');
        this.anchorStatus.textContent = this.anchorX ? '锚点已设置，可开始录制' : '点击屏幕设置锚点';
        this.timerDisplay.style.display = 'none';
        this.movementIndicator.style.display = 'none';
    }

    detectionLoop() {
        if (!this.isRecording) return;

        // 检测移动
        const hasMovement = this.checkMovement();

        if (hasMovement && !this.hasMovement) {
            // 首次检测到移动
            this.hasMovement = true;
            this.recordingStartTime = Date.now();

            // 开始计时
            this.timerDisplay.style.display = 'block';
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);

            // 显示移动提示
            this.movementIndicator.style.display = 'block';
            setTimeout(() => {
                this.movementIndicator.style.display = 'none';
            }, 2000);

            this.anchorStatus.textContent = '检测到移动！';
        }

        if (this.hasMovement) {
            // 绘制轨迹
            this.drawTrajectory();
        }

        // 继续循环
        this.animationFrame = requestAnimationFrame(() => this.detectionLoop());
    }

    drawTrajectory() {
        // 获取当前锚点位置（实际锚点不会移动，这里检测的是该位置的像素变化）
        // 为了绘制轨迹，我们追踪该区域的中心位置变化

        // 计算轨迹canvas上的坐标
        const videoRect = this.videoElement.getBoundingClientRect();
        const scaleX = videoRect.width / this.videoElement.videoWidth;
        const scaleY = videoRect.height / this.videoElement.videoHeight;

        // 将视频坐标转换为canvas坐标（需要考虑翻转）
        const canvasX = videoRect.width - (this.anchorX * scaleX);
        const canvasY = this.anchorY * scaleY;

        // 添加轨迹点
        this.trajectoryPoints.push({ x: canvasX, y: canvasY });

        // 绘制轨迹
        if (this.trajectoryPoints.length > 1) {
            this.canvasCtx.beginPath();
            this.canvasCtx.strokeStyle = this.settings.color;
            this.canvasCtx.lineWidth = this.settings.lineWidth;
            this.canvasCtx.lineCap = 'round';
            this.canvasCtx.lineJoin = 'round';

            this.canvasCtx.moveTo(this.trajectoryPoints[0].x, this.trajectoryPoints[0].y);
            for (let i = 1; i < this.trajectoryPoints.length; i++) {
                this.canvasCtx.lineTo(this.trajectoryPoints[i].x, this.trajectoryPoints[i].y);
            }

            this.canvasCtx.stroke();

            // 绘制点
            this.canvasCtx.fillStyle = this.settings.color;
            this.trajectoryPoints.forEach(point => {
                this.canvasCtx.beginPath();
                this.canvasCtx.arc(point.x, point.y, this.settings.lineWidth, 0, Math.PI * 2);
                this.canvasCtx.fill();
            });
        }
    }

    updateTimer() {
        if (!this.recordingStartTime) return;

        const elapsed = Date.now() - this.recordingStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        this.timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    showVideoPreview() {
        // 创建视频blob
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        this.previewVideo.src = url;
        this.videoPreview.classList.add('active');

        // 保存blob引用
        this.currentVideoBlob = blob;
    }

    closeVideoPreview() {
        this.videoPreview.classList.remove('active');
        this.previewVideo.src = '';
        URL.revokeObjectURL(this.previewVideo.src);
        this.currentVideoBlob = null;
    }

    saveVideo() {
        if (!this.currentVideoBlob) return;

        const url = URL.createObjectURL(this.currentVideoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tut_recording_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        alert('视频已下载！您可以在文件应用中查看，或分享到相册。');
    }

    clearAnchor() {
        this.anchorX = null;
        this.anchorY = null;
        this.initialImageData = null;

        // 更新UI
        this.anchorPoint.style.display = 'none';
        this.anchorStatus.textContent = '点击屏幕设置锚点';
        this.anchorStatus.classList.remove('active');
        this.clearAnchorBtn.disabled = true;

        // 清空轨迹
        this.canvasCtx.clearRect(0, 0, this.trajectoryCanvas.width, this.trajectoryCanvas.height);
    }

    openSettings() {
        this.settingsPanel.classList.add('active');
    }

    closeSettings() {
        this.settingsPanel.classList.remove('active');
    }

    resizeCanvas() {
        const rect = this.cameraContainer.getBoundingClientRect();
        this.trajectoryCanvas.width = rect.width;
        this.trajectoryCanvas.height = rect.height;

        // 重绘轨迹
        if (this.trajectoryPoints.length > 0 && this.canvasCtx) {
            this.canvasCtx.strokeStyle = this.settings.color;
            this.canvasCtx.lineWidth = this.settings.lineWidth;
            this.canvasCtx.lineCap = 'round';
            this.canvasCtx.lineJoin = 'round';

            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(this.trajectoryPoints[0].x, this.trajectoryPoints[0].y);
            for (let i = 1; i < this.trajectoryPoints.length; i++) {
                this.canvasCtx.lineTo(this.trajectoryPoints[i].x, this.trajectoryPoints[i].y);
            }
            this.canvasCtx.stroke();
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new TutApp();
});

// 注册Service Worker（可选，用于离线支持）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 可以在这里注册service worker实现离线功能
        // navigator.serviceWorker.register('/service-worker.js');
    });
}
