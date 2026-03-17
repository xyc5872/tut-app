// tut应用主逻辑 - 使用 OpenCV 光流法

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
        this.opencvLoading = document.getElementById('opencvLoading');
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
        this.anchorIndex = null; // 锚点在特征点中的索引
        this.isRecording = false;
        this.hasMovement = false;
        this.recordingStartTime = null;
        this.firstMovementTime = null;
        this.tutTime = 0;
        this.trajectoryPoints = [];
        this.trackingPosition = { x: null, y: null };
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.timerInterval = null;
        this.animationFrame = null;
        this.canvasCtx = this.trajectoryCanvas.getContext('2d');

        // OpenCV 相关变量
        this.cv = null; // OpenCV 对象
        this.opencvReady = false;
        this.prevGray = null;
        this.nextGray = null;
        this.featurePoints = null; // 特征点
        this.prevPoints = null; // 前一帧的特征点
        this.nextPoints = null; // 当前帧的特征点
        this.status = null; // 光流追踪状态
        this.err = null; // 光流追踪误差

        // 混合canvas用于录制
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCtx = this.compositeCanvas.getContext('2d');

        // 设置参数
        this.settings = {
            sensitivity: 30,
            color: '#ff3b30',
            lineWidth: 3
        };

        // 等待 OpenCV 加载
        this.waitForOpenCv();
    }

    // 等待 OpenCV 加载完成
    waitForOpenCv() {
        this.opencvLoading.style.display = 'block';
        this.loading.style.display = 'none';

        if (typeof cv !== 'undefined' && cv.Mat) {
            this.cv = cv;
            this.opencvReady = true;
            this.opencvLoading.style.display = 'none';
            this.init();
        } else {
            setTimeout(() => this.waitForOpenCv(), 100);
        }
    }

    async init() {
        try {
            await this.requestCameraPermission();
        } catch (error) {
            console.error('相机初始化失败:', error);
            this.showPermissionRequest();
        }

        this.bindEvents();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    async requestCameraPermission() {
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.videoElement.srcObject = this.stream;

        await new Promise((resolve) => {
            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play();
                resolve();
            };
        });

        this.loading.style.display = 'none';

        // 初始化 OpenCV Mat
        const height = 360; // 降低分辨率提高性能
        const width = 640;
        this.prevGray = new cv.Mat(height, width, cv.CV_8UC1);
        this.nextGray = new cv.Mat(height, width, cv.CV_8UC1);
        this.status = new cv.Mat();
        this.err = new cv.Mat();
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
        this.cameraContainer.addEventListener('click', (e) => this.handleContainerClick(e));
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.clearAnchorBtn.addEventListener('click', () => this.clearAnchor());
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.sensitivitySlider.addEventListener('input', (e) => {
            this.settings.sensitivity = parseInt(e.target.value);
            this.sensitivityValue.textContent = e.target.value;
        });
        this.colorSelect.addEventListener('change', (e) => {
            this.settings.color = e.target.value;
            this.anchorPoint.style.borderColor = this.settings.color;
            this.anchorPoint.style.background = this.settings.color + '33';
        });
        this.lineWidthSlider.addEventListener('input', (e) => {
            this.settings.lineWidth = parseInt(e.target.value);
            this.lineWidthValue.textContent = e.target.value;
        });
        this.closePreviewBtn.addEventListener('click', () => this.closeVideoPreview());
        this.saveVideoBtn.addEventListener('click', () => this.saveVideo());
    }

    handleContainerClick(e) {
        if (this.isRecording) return;

        const rect = this.cameraContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const videoRect = this.videoElement.getBoundingClientRect();
        const scaleX = this.videoElement.videoWidth / videoRect.width;
        const scaleY = this.videoElement.videoHeight / videoRect.height;

        const actualX = x * scaleX;
        const actualY = y * scaleY;

        this.anchorX = actualX;
        this.anchorY = actualY;
        this.trackingPosition = { x: actualX, y: actualY };

        // 更新UI
        this.anchorPoint.style.left = `${x}px`;
        this.anchorPoint.style.top = `${y}px`;
        this.anchorPoint.style.display = 'block';
        this.anchorStatus.textContent = '锚点已设置，可开始录制';
        this.anchorStatus.classList.add('active');
        this.clearAnchorBtn.disabled = false;

        // 检测特征点
        this.detectFeatures();
    }

    // 检测特征点
    detectFeatures() {
        const cap = new cv.VideoCapture(this.videoElement);
        cap.read(this.nextGray);

        // 检测角点作为特征点
        const maxCorners = 50;
        const qualityLevel = 0.01;
        const minDistance = 30;
        const blockSize = 7;

        this.featurePoints = new cv.Mat();
        cv.goodFeaturesToTrack(
            this.nextGray,
            this.featurePoints,
            maxCorners,
            qualityLevel,
            minDistance
        );

        // 找到最接近锚点的特征点
        let minDist = Infinity;
        this.anchorIndex = -1;

        for (let i = 0; i < this.featurePoints.rows; i++) {
            const x = this.featurePoints.data32F[i * 2];
            const y = this.featurePoints.data32F[i * 2 + 1];

            const dist = Math.sqrt(Math.pow(x - this.anchorX, 2) + Math.pow(y - this.anchorY, 2));
            if (dist < minDist) {
                minDist = dist;
                this.anchorIndex = i;
            }
        }

        if (this.anchorIndex === -1) {
            alert('未找到适合的特征点，请选择纹理更丰富的区域。');
            this.clearAnchor();
            return;
        }

        console.log(`检测到 ${this.featurePoints.rows} 个特征点，锚点索引: ${this.anchorIndex}`);

        // 交换 prevGray 和 nextGray
        [this.prevGray, this.nextGray] = [this.nextGray, this.prevGray];
    }

    // 使用光流法追踪
    trackMovement() {
        if (!this.featurePoints || !this.opencvReady) {
            return { position: this.trackingPosition, hasMoved: false };
        }

        const cap = new cv.VideoCapture(this.videoElement);
        cap.read(this.nextGray);

        // 计算光流
        this.prevPoints = this.featurePoints;
        this.nextPoints = new cv.Mat();

        cv.calcOpticalFlowPyrLK(
            this.prevGray,
            this.nextGray,
            this.prevPoints,
            this.nextPoints,
            this.status,
            this.err
        );

        // 分析特征点运动
        const globalMotion = this.calculateGlobalMotion();
        const anchorMotion = this.getAnchorMotion();

        // 计算相对运动（锚点运动 - 全局运动）
        const relativeMotionX = anchorMotion.x - globalMotion.x;
        const relativeMotionY = anchorMotion.y - globalMotion.y;
        const relativeDistance = Math.sqrt(relativeMotionX * relativeMotionX + relativeMotionY * relativeMotionY);

        // 更新锚点位置
        if (this.anchorIndex < this.nextPoints.rows) {
            const scale = this.videoElement.videoWidth / 640; // OpenCV 使用 640x360
            this.trackingPosition.x = this.nextPoints.data32F[this.anchorIndex * 2] / scale;
            this.trackingPosition.y = this.nextPoints.data32F[this.anchorIndex * 2 + 1] / scale;
        }

        // 交换 prevGray 和 nextGray
        [this.prevGray, this.nextGray] = [this.nextGray, this.prevGray];

        // 更新特征点
        this.featurePoints = this.nextPoints;

        // 判断是否有真移动
        const threshold = (100 - this.settings.sensitivity) * 0.5;
        const hasMoved = relativeDistance > threshold;

        if (hasMoved) {
            console.log(`检测到移动！相对距离: ${relativeDistance.toFixed(2)}, 阈值: ${threshold.toFixed(2)}`);
        }

        return { position: this.trackingPosition, hasMoved: hasMoved };
    }

    // 计算全局运动（所有特征点的平均运动）
    calculateGlobalMotion() {
        if (!this.prevPoints || !this.nextPoints || this.prevPoints.rows === 0) {
            return { x: 0, y: 0 };
        }

        let totalDx = 0;
        let totalDy = 0;
        let count = 0;

        for (let i = 0; i < Math.min(this.prevPoints.rows, this.nextPoints.rows); i++) {
            const status = this.status.data[i];
            if (status === 1) { // 追踪成功
                const prevX = this.prevPoints.data32F[i * 2];
                const prevY = this.prevPoints.data32F[i * 2 + 1];
                const nextX = this.nextPoints.data32F[i * 2];
                const nextY = this.nextPoints.data32F[i * 2 + 1];

                totalDx += nextX - prevX;
                totalDy += nextY - prevY;
                count++;
            }
        }

        return {
            x: count > 0 ? totalDx / count : 0,
            y: count > 0 ? totalDy / count : 0
        };
    }

    // 获取锚点的运动
    getAnchorMotion() {
        if (!this.prevPoints || !this.nextPoints || this.anchorIndex < 0) {
            return { x: 0, y: 0 };
        }

        if (this.anchorIndex >= this.prevPoints.rows || this.anchorIndex >= this.nextPoints.rows) {
            return { x: 0, y: 0 };
        }

        const status = this.status.data[this.anchorIndex];
        if (status !== 1) {
            return { x: 0, y: 0 };
        }

        const prevX = this.prevPoints.data32F[this.anchorIndex * 2];
        const prevY = this.prevPoints.data32F[this.anchorIndex * 2 + 1];
        const nextX = this.nextPoints.data32F[this.anchorIndex * 2];
        const nextY = this.nextPoints.data32F[this.anchorIndex * 2 + 1];

        return {
            x: nextX - prevX,
            y: nextY - prevY
        };
    }

    toggleRecording() {
        if (!this.anchorX || !this.anchorY || this.anchorIndex < 0) {
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
        this.firstMovementTime = null;
        this.tutTime = 0;
        this.trajectoryPoints = [];
        this.recordedChunks = [];

        // 更新UI
        this.recordBtn.textContent = '停止录制';
        this.recordBtn.classList.remove('btn-primary');
        this.recordBtn.classList.add('btn-danger');
        this.anchorStatus.textContent = '录制中...';

        // 清空轨迹canvas
        this.canvasCtx.clearRect(0, 0, this.trajectoryCanvas.width, this.trajectoryCanvas.height);

        // 设置混合canvas大小
        const rect = this.cameraContainer.getBoundingClientRect();
        this.compositeCanvas.width = rect.width;
        this.compositeCanvas.height = rect.height;

        // 重新检测特征点
        this.detectFeatures();

        // 开始录制视频
        const canvasStream = this.compositeCanvas.captureStream(30);
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

        if (this.firstMovementTime) {
            this.tutTime = Date.now() - this.firstMovementTime;
        } else {
            this.tutTime = 0;
        }

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.recordBtn.textContent = '开始录制';
        this.recordBtn.classList.remove('btn-danger');
        this.recordBtn.classList.add('btn-primary');
        this.anchorStatus.textContent = this.anchorX ? '锚点已设置，可开始录制' : '点击屏幕设置锚点';
        this.timerDisplay.style.display = 'none';
        this.movementIndicator.style.display = 'none';
    }

    detectionLoop() {
        if (!this.isRecording) return;

        const trackingResult = this.trackMovement();
        const hasMovement = trackingResult.hasMoved;
        const position = trackingResult.position;

        if (hasMovement && !this.hasMovement) {
            this.hasMovement = true;
            this.firstMovementTime = Date.now();
            this.recordingStartTime = Date.now();

            this.timerDisplay.style.display = 'block';
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);

            this.movementIndicator.style.display = 'block';
            setTimeout(() => {
                this.movementIndicator.style.display = 'none';
            }, 2000);

            this.anchorStatus.textContent = '检测到移动！';
        }

        if (this.hasMovement) {
            this.drawTrajectory(position);
        }

        this.drawComposite();

        this.animationFrame = requestAnimationFrame(() => this.detectionLoop());
    }

    drawTrajectory(position) {
        const videoRect = this.videoElement.getBoundingClientRect();
        const scaleX = videoRect.width / this.videoElement.videoWidth;
        const scaleY = videoRect.height / this.videoElement.videoHeight;

        const canvasX = position.x * scaleX;
        const canvasY = position.y * scaleY;

        this.trajectoryPoints.push({ x: canvasX, y: canvasY });

        if (this.trajectoryPoints.length > 1000) {
            this.trajectoryPoints.shift();
        }

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

            const lastPoint = this.trajectoryPoints[this.trajectoryPoints.length - 1];
            this.canvasCtx.fillStyle = this.settings.color;
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(lastPoint.x, lastPoint.y, this.settings.lineWidth + 2, 0, Math.PI * 2);
            this.canvasCtx.fill();
        }
    }

    drawComposite() {
        const rect = this.cameraContainer.getBoundingClientRect();

        this.compositeCtx.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);

        this.compositeCtx.drawImage(
            this.videoElement,
            0, 0,
            this.compositeCanvas.width,
            this.compositeCanvas.height
        );

        this.compositeCtx.drawImage(this.trajectoryCanvas, 0, 0);

        if (this.trackingPosition.x !== null && this.trackingPosition.y !== null) {
            const videoRect = this.videoElement.getBoundingClientRect();
            const scaleX = videoRect.width / this.videoElement.videoWidth;
            const scaleY = videoRect.height / this.videoElement.videoHeight;

            const anchorCanvasX = this.trackingPosition.x * scaleX;
            const anchorCanvasY = this.trackingPosition.y * scaleY;

            this.compositeCtx.beginPath();
            this.compositeCtx.strokeStyle = this.settings.color;
            this.compositeCtx.lineWidth = 3;
            this.compositeCtx.arc(anchorCanvasX, anchorCanvasY, 15, 0, Math.PI * 2);
            this.compositeCtx.stroke();

            this.compositeCtx.fillStyle = this.settings.color + '80';
            this.compositeCtx.fill();

            this.compositeCtx.fillStyle = '#ffffff';
            this.compositeCtx.beginPath();
            this.compositeCtx.arc(anchorCanvasX, anchorCanvasY, 5, 0, Math.PI * 2);
            this.compositeCtx.fill();
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
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        this.previewVideo.src = url;
        this.videoPreview.classList.add('active');

        this.currentVideoBlob = blob;

        this.updateTutTimeDisplay();
    }

    updateTutTimeDisplay() {
        const tutTimeDisplay = document.getElementById('tutTimeDisplay');
        const hours = Math.floor(this.tutTime / 3600000);
        const minutes = Math.floor((this.tutTime % 3600000) / 60000);
        const seconds = Math.floor((this.tutTime % 60000) / 1000);

        tutTimeDisplay.textContent = `本次Tut时间：${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

        alert('视频已下载！您可以在文件应用中查看。');
    }

    clearAnchor() {
        this.anchorX = null;
        this.anchorY = null;
        this.anchorIndex = null;
        this.trackingPosition = { x: null, y: null };
        this.featurePoints = null;

        this.anchorPoint.style.display = 'none';
        this.anchorStatus.textContent = '点击屏幕设置锚点';
        this.anchorStatus.classList.remove('active');
        this.clearAnchorBtn.disabled = true;

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

        this.compositeCanvas.width = rect.width;
        this.compositeCanvas.height = rect.height;

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

// OpenCV 加载完成后的回调
function onOpenCvReady() {
    console.log('OpenCV 加载完成');
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new TutApp();
});
